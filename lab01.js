// The pitch of the currently playing note
var this_pitch;

// The MIDI pitch number for the first (left) keyboard key
var lowest_pitch = 60;

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

$(document).ready(function() {
    MIDI.loadPlugin({
        soundfontUrl: "./midi-js/soundfont/",
        instruments: [
            "trumpet"
            //
            // You can optionally list the instruments here to preload the
            // instruments; alternatively, each instrument will be loaded
            // when you send the program change event
            //
        ],
        onprogress: function(state, progress) {
            console.log(state, progress);
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
            MIDI.programChange(0, parseInt($('#program').val()));  // Get the first value of instrument select

            // Set up the event handlers for all the buttons
            $(".piano-key").on("mousedown", handlePianoKeyPress);
            $(".piano-key").on("mouseup", handlePianoKeyRelease);

            //
            // You probably need to set up an event for your instrument change
            //
            $('#program').change(function() {
                MIDI.programChange(0, parseInt($(this).val()));
            });
        }
    });
});
