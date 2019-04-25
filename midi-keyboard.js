// The pitch of the currently playing note
var this_pitch;

// The MIDI pitch number for the first (left) keyboard key
var lowest_pitch = 60;

// Theoretical: 35 - 81 inclusive
var tracks = [];
var pages = [tracks]; // an indexed array of tracks
var drumPlayTimeoutId = null; // to store the drum timeout id
var drumPlayInfo = null;
var loopSingle = true;
var inPageLoop = false;
var currentPage = 1;
// Number of buttons per track
var track_length = 16;

function handlePianoKeyPress(evt) {
    var this_key, this_amplitude;

    // Determine which piano key has been pressed.
    // 'evt.target' tells us exactly which item triggered this function.

    // The piano key number is taken from the 'data-piano-key-number' attribute of each button.
    // The piano key number is a value in the range 0 to 23 inclusive.
    this_key = $(evt.target).data("pianoKeyNumber");

    // Read the lowest pitch and update global variable lowest_pitch.
    lowest_pitch = parseInt($("#pitch").val());

    this_pitch = lowest_pitch + parseInt(this_key);

    // Extract the amplitude value from the slider
    this_amplitude = $("#amplitude").val();

    // Convert the string into actual values
    this_amplitude = parseInt(this_amplitude);

    // Use the two numbers to start a MIDI note
    MIDI.noteOn(0, this_pitch, this_amplitude);

    //
    // You need to handle the chord mode here
    //
    var mode = $(":radio[name=play-mode]:checked").val();

    if (mode == "major" && this_pitch <= 104) {
        MIDI.noteOn(0, this_pitch + 4, this_amplitude);
    } else if (mode == "minor" && this_pitch <= 105) {
        MIDI.noteOn(0, this_pitch + 3, this_amplitude);
    }

    if (mode != "single" && this_pitch <= 101) {
        MIDI.noteOn(0, this_pitch + 7, this_amplitude);
    }

    // Show a simple message in the console
    console.log("Key press event for key " + this_pitch + "!");
}

function handlePianoKeyRelease(evt) {
    // Send the note off message to match the pitch of the current note on event
    MIDI.noteOff(0, this_pitch);

    //
    // You need to handle the chord mode here
    //
    var mode = $(":radio[name=play-mode]:checked").val();

    if (mode == "major" && this_pitch <= 104) {
        MIDI.noteOff(0, this_pitch + 4);
    } else if (mode == "minor" && this_pitch <= 105) {
        MIDI.noteOff(0, this_pitch + 3);
    }

    if (mode != "single" && this_pitch <= 101) {
        MIDI.noteOff(0, this_pitch + 7);
    }

    // Show a simple message in the console
    console.log("Key release event for key " + this_pitch + "!");
}

function getIndexFromTrackID(track_id) {
    for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].id == track_id) {
            return i;
        }
    }
    return -1;
}

function switchPage(page, implicit=true) {
    if (implicit && drumPlayInfo) return;
    tracks = pages[page - 1];
    currentPage = page;
    updateAllBeatButton();
    // switch the indication of buttons as well
    let pageRow = document.getElementById("page-row")
    for (let i = 0; i < pageRow.childNodes.length; i++) {
        let btn = pageRow.childNodes[i];
        if (btn.id == "btn-page-" + page) btn.classList.add("rect-btn-enabled");
        else btn.classList.remove("rect-btn-enabled");       
    }
}

// update all beats displayed base on the current values in tracks
function updateAllBeatButton() {
    for (let i = 0; i < tracks.length; i++) {
        let id = tracks[i].id;
        for (let n = 0; n < track_length; n++) {
            let beatBtn = document.getElementById("beat-btn-" + id + "-" + n);
            if (tracks[i].hits[n])
                beatBtn.style.backgroundColor = "rgb(53, 202, 197)";
            else beatBtn.style.backgroundColor = "#222";
        }
    }
}

function popPage() {
    if (drumPlayInfo) return;
    if (pages.length <= 1) return;
    if (currentPage == pages.length) switchPage(pages.length - 1);
    pages.pop();
    // Remove the button
    let pageId = pages.length;
    let pageRow = document.getElementById("page-row");
    pageRow.removeChild(pageRow.lastChild);
}

function addPage() {
    if (drumPlayInfo) return;
    // Create a new pattern and append into global pages
    var pattern = [];
    for (let i = 0; i < tracks.length; i++) {
        // do a member-wise copying
        var t = Object.assign({}, tracks[i]);
        t.hits = t.hits.map(v => 0);
        pattern.push(t);
    }
    pages.push(pattern);

    let pageId = pages.length;
    let pageRow = document.getElementById("page-row");
    // Append the button
    var btn = document.createElement("button");
    btn.id = "btn-page-" + pageId;
    btn.classList.add("gradient-bg");
    btn.classList.add("rect-btn-toggle");
    btn.setAttribute("type", "button");
    btn.setAttribute("onclick", "switchPage(" + pageId + ")");
    btn.textContent = pageId;
    pageRow.appendChild(btn);
    // Switch to the new created page
    switchPage(pageId);
}

function playPattern() {
    // remove the original play function and append the new pause function
    let playBtn = document.getElementById("play-btn");
    playBtn.setAttribute("onclick", "pausePattern()");
    // calcuate speed
    let bpm = parseInt($("#tempo").val());
    let dt = 1000 / 4 / (bpm / 60);
    // check whether this is resuming or starting
    if (drumPlayInfo) 
        nextBeat(drumPlayInfo + 1, dt);
    else 
        nextBeat(0, dt);
    // Change the play button into pause button
    $("#play-btn").html('<i class="fas fa-pause"></i>');    
}

function pausePattern() { 
    // stop the timeout
    clearTimeout(drumPlaying);
    let playBtn = document.getElementById("play-btn");
    playBtn.setAttribute("onclick", "playPattern()")
    // Change the pause button into play button
    $("#play-btn").html('<i class="fas fa-play"></i>');  
}

function stopPattern() {
    if (!drumPlayInfo) return;    
    clearTimeout(drumPlaying);
    // light off all buttons
    lightResumeAllX(drumPlayInfo);
    drumPlayInfo = null;
    // Change the the play button to play button anyway
    $("#play-btn").html('<i class="fas fa-play"></i>'); 
    let playBtn = document.getElementById("play-btn");
    playBtn.setAttribute("onclick", "playPattern()");
}

function nextBeat(n, dt) {
    // reach the last button => light off all buttons
    if (n > track_length - 1) {
        lightResumeAllX(n - 1);
        if (loopSingle) {
            // back to the beginning of this page
            nextBeat(0, dt);  
        }
        else {
            if (currentPage < pages.length) {
                // Start from next page
                switchPage(currentPage + 1, false);
            }
            else {
                // Back to the beginning of page 1
                switchPage(1, false);                 
            }
            nextBeat(0, dt);
        }       
        return; 

        /*
        // reset info back to null
        drumPlayInfo = null;
        // Change the pause button into play button
        $("#play-btn").html('<i class="fas fa-play"></i>');
        let playBtn = document.getElementById("play-btn");
        playBtn.setAttribute("onclick", "playPattern()");
        return;
        */
    }
    // update the global drum playing info
    drumPlayInfo = n;
    // play the drum beat in each track
    for (let i = 0; i < tracks.length; i++) {
        let id = tracks[i].id;
        // Light off the previous column then light on this column
        lightResumeX(id, n - 1)
        lightUpX(id, n);

        // handle volume with real-time calculation
        let m_volume = parseInt($("#master-volume").val());
        let p_volume = parseInt($("#track-" + id + "-volume").val());
        let volume = m_volume * p_volume / 128;

        // format: {id: track_id, drumtype: drumtype, hits: hits_array}
        let drumtype = tracks[i].drumtype;
        if (tracks[i].hits[n]) {
            MIDI.noteOn(0, drumtype, volume);
            // TODO see if 50ms is a good value
            setTimeout(() => {MIDI.noteOff(0, drumtype)}, 50);
        }
    }
    drumPlaying = setTimeout(() => {
        nextBeat(n+1, dt);
    }, dt);
}

function lightUpX(id, x) {
    let beatBtn = document.getElementById("beat-btn-" + id + "-" + x);
    if (beatBtn.style.backgroundColor == "rgb(53, 202, 197)") beatBtn.style.backgroundColor = "rgb(150, 230, 230)";
    else beatBtn.style.backgroundColor = "#555";
}

function lightResumeX(id, x) {
    if (x < 0) return;
    let beatBtn = document.getElementById("beat-btn-" + id + "-" + x);
    if (beatBtn.style.backgroundColor == "rgb(150, 230, 230)") beatBtn.style.backgroundColor = "rgb(53, 202, 197)";
    else beatBtn.style.backgroundColor = "#222";
}

function lightResumeAllX(x) {
    for (let i = 0; i < tracks.length; i++) {
        let id = tracks[i].id;
        lightResumeX(id, x);
    }
}

function toggleLoop() {
    loopSingle = !loopSingle;
    let loopBtn = document.getElementById("loop-btn");
    let loopBtnIcon = document.getElementById("loop-btn-icon");
    if (loopSingle) {
        loopBtnIcon.classList.remove("fa-sync-alt");
        loopBtnIcon.classList.add("fa-redo");     
    }
    else {
        loopBtnIcon.classList.remove("fa-redo");
        loopBtnIcon.classList.add("fa-sync-alt");
    }
}

function handleDrumKeyPress(evt, track, btn_id, activate=true) {
    let master_volume = parseInt($("#master-volume").val());
    let private_volume = parseInt($("#track-" + track + "-volume").val());
    let volume = master_volume * private_volume / 128;
    let track_index = getIndexFromTrackID(track);
    let drumtype = tracks[track_index].drumtype;
    if (activate) {
        tracks[track_index].hits[btn_id] = 1; // store value into tracks
        // start a MIDI note only if the drum is not playing
        if (!drumPlayInfo) MIDI.noteOn(0, drumtype, volume);
    }
    else {
        tracks[track_index].hits[btn_id] = 0;
    }
    // Show a simple message in the console
    console.log("Key press event "+ drumtype +" from track " + track + "!");
}

function handleDrumKeyRelease(evt, track) {
    let track_index = getIndexFromTrackID(track);
    let drumtype = tracks[track_index].drumtype;
    MIDI.noteOff(0, drumtype);
}

function addTrack(name, drumtype) {
    // Determine track_id of track that we have to add
    let track_id = 1;
    if (tracks.length > 0) {
        track_id = tracks[tracks.length - 1].id + 1;
    }

    // Add the track to all pages
    for (let i = 0; i < pages.length; i++) {
        let hits_array = Array(track_length).fill(0);
        pages[i].push({id: track_id, drumtype: drumtype, hits: hits_array});
    }

    // Prepare the element to append for each row
    let elem = '<div class="row"><div class="track-name col-2">' + name + '</div><div class="beats-panel col-7">';
    for (let i = 0; i < track_length; i++) {
        elem += '<button class="beat-btn" type="button" id="beat-btn-'+track_id+'-'+i+
        '" track="' + track_id + '" code="' + i + '"></button> ';
    }
    elem += '</div><div class="col-1"><input id="track-' + track_id + '-volume" class="slider" type="range" min="0" max="128" value="128" /></div>';
    elem += '<div class="col-1"><input id="track-' + track_id + '-pitch" class="slider" type="range" min="0" max="100" value="50" /></div>';
    elem += '<div class="col-1"><button type="button" track="' + track_id + '" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button></div></div>';

    $("#track-area").append(elem);
}

$(document).ready(function() {
    $('[data-toggle="tooltip"]').tooltip();
    // Add the two test channels
    addTrack("Example 1", 35);
    addTrack("Example 2", 38);
    MIDI.loadPlugin({
        soundfontUrl: "./midi-js/soundfont/",
        // You can optionally list the instruments here to preload the
        // instruments; alternatively, each instrument will be loaded
        // when you send the program change event
        instruments: [
            "trumpet",
            "drum"
        ],
        onprogress: function(state, progress) {
            // console.log(state, progress);
        },
        onsuccess: function() {
            // Resuming the AudioContext when there is user interaction
            $("body").click(function() {
                if (MIDI.getContext().state != "running") {
                    MIDI.getContext().resume().then(function() {
                        console.log("Audio Context is resumed!");
                    });
                }
            });

            // At this point the MIDI system is ready to be used
            MIDI.setVolume(0, 127);     // Set the volume level
            // I have changed "gunshot" (127) into the drum soundfont (AG)
            MIDI.programChange(0, 127);  // Go to the drum soundfont

            // Set up the event handlers for all the buttons
            $(".piano-key").on("mousedown", handlePianoKeyPress);
            $(".piano-key").on("mouseup", handlePianoKeyRelease);

            $(document.body).on("mousedown", ".beat-btn", function(evt) {
                let track_id = parseInt($(this).attr("track"));
                let btn_id = parseInt($(this).attr("code"));
                let indx = getIndexFromTrackID(track_id);
                let on = (tracks[indx].hits[btn_id] ? false : true);
                if (on) {
                    $(this).css("background-color", "rgb(53,202,197)");
                } else {
                    $(this).css("background-color", "#222");
                }
                handleDrumKeyPress(evt, track_id, btn_id, on);
            });
            $(document.body).on("mouseup", ".beat-btn", function(evt) {
                let track_id = parseInt($(this).attr("track"));
                handleDrumKeyRelease(evt, track_id);
            });

            // Delete button for each track.
            $(document.body).on("click", ".close", function() {
                if (drumPlayInfo) return; // cannot remove any when playing
                let track_id = parseInt($(this).attr("track"));
                $(this).parent().parent().remove();
                for (let i = 0; i < pages.length; i++) {
                    pages[i] = pages[i].filter(elem => elem.id != track_id);                    
                    // refer track again since pages[i] is a new reference now
                    if (tracks.id == pages[i].id) tracks = pages[i];
                }
                console.log(pages, tracks);
            });

            // Add track button.
            $("#track-add").click(function() {
                let name = $("#track-add-name").val();
                let drumtype = parseInt($("#track-add-drumtype").val());
                addTrack(name, drumtype);
            })

            // You probably need to set up an event for your instrument change
            $('#program').change(function() {
                MIDI.programChange(0, parseInt($(this).val()));
            });
            $("#midi-keyboard-tab").click(function() {
                MIDI.programChange(0, parseInt($("#program").val()));
            });
            $("#drum-machine-tab").click(function() {
                MIDI.programChange(0, 127);
            });
        }
    });
});
