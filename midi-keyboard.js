// The pitch of the currently playing note
var this_pitch;

// The MIDI pitch number for the first (left) keyboard key
var lowest_pitch = 60;

// Theoretical: 35 - 81 inclusive
var tracks = [];

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

function handleDrumKeyPress(evt, track, btn_id, activate=true) {
    let master_volume = parseInt($("#master-volume").val());
    let private_volume = parseInt($("#track-" + track + "-volume").val());
    let volume = master_volume * private_volume / 128;
    let drumtype = tracks[track - 1].drumtype;
    if (activate) {
        tracks[track - 1].hits[btn_id] = 1; // store value into tracks
        MIDI.noteOn(0, drumtype, volume); // start a MIDI note
    }
    else {
        tracks[track - 1].hits[btn_id] = 0;
    }
    // Show a simple message in the console
    console.log("Key press event "+ drumtype +" from track " + track + "!");
}

function handleDrumKeyRelease(evt, track) {
    let drumtype = tracks[track - 1].drumtype;
    MIDI.noteOff(0, drumtype);
}

function addTrack(name, drumtype) {
    // Determine track_id of track that we have to add
    let track_id = 1;
    if (tracks.length > 0) {
        track_id = tracks[tracks.length - 1].id + 1;
    }

    // Add the track to tracks array
    tracks.push({id: track_id, drumtype: drumtype, hits: [0, 0, 0, 0, 0, 0, 0, 0]});

    // Prepare the element to append for each row
    let elem = '<div class="row"><div class="track-name col-2">' + name + '</div><div class="beats-panel col-7">';
    for (let i = 0; i < 8; i++) {
        elem += '<button class="beat-btn" type="button" track="' + track_id + '" code="' + i + '"></button> ';
    }
    elem += '</div><div class="col-1"><input id="track-' + track_id + '-volume" class="slider" type="range" min="0" max="100" value="100" /></div>';
    elem += '<div class="col-1"><input id="track-' + track_id + '-pitch" class="slider" type="range" min="0" max="100" value="50" /></div>';
    elem += '<div class="col-1"><button type="button" track="' + track_id + '" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button></div></div>';

    $("#track-area").append(elem);
}

$(document).ready(function() {
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

            // Add the two test channels
            addTrack("Example 1", 35);
            addTrack("Example 2", 38);

            // Set up the event handlers for all the buttons
            $(".piano-key").on("mousedown", handlePianoKeyPress);
            $(".piano-key").on("mouseup", handlePianoKeyRelease);

            $(document.body).on("mousedown", ".beat-btn", function(evt) {
                let track_id = parseInt($(this).attr("track"));
                let btn_id = parseInt($(this).attr("code"));
                this.on = !this.on;

                if (this.on) {
                    $(this).css("background-color", "rgb(53,202,197)");
                } else {
                    $(this).css("background-color", "#222");
                }
                handleDrumKeyPress(evt, track_id, btn_id, this.on);
            });
            $(document.body).on("mouseup", ".beat-btn", function(evt) {
                let track_id = parseInt($(this).attr("track"));
                handleDrumKeyRelease(evt, track_id);
            });

            // Delete button for each track.
            $(document.body).on("click", ".close", function() {
                let track_id = parseInt($(this).attr("track"));
                $(this).parent().parent().remove();
                tracks = tracks.filter(function(elem) {
                    return elem.id != track_id;
                });
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
