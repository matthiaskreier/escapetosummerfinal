/*
The code below is for an escape room style activity we are doing at the end of school. 
I wanted to use the micro:bit as a way to verify that students figured out the correct sequence
of button presses that is the answer to a previous challenge. Students enter a code by pressing the
A and B buttons on the micro:bit. This also was an opportunity to create a complex example for future students.

If you want to see what this does, open the simulator at left and try it out. The correct sequence to enter is AAABABBAA.

Students, if you're reading, that is not the sequence that solves the escape room.

If you want to know more about the code, read on.

This is a hacky implementation of a state machine - something that sets outputs according to its current
state, and only changes its state based on current values of inputs and variables. I wanted these states to be:

    1. Waiting for a code to be entered (IDLE)
    2. Collecting a series of button presses until a complete code is entered, and display the entered code on the screen (ENTERING_CODE)
    3. The code is entered, but has not been verified to be correct or not (CODE_ENTERED)
    4. The code entered is correct (CODE_CORRECT) leading to a success message, or the code entered is incorrect (CODE_INCORRECT) 
        which shows an error message, and then returns to the IDLE state.

For this to work, I also wanted events to be non-blocking or asynchronous. This means that the main loop is running continuously
rather than waiting for one block of code to happen before the next. This is how most robotic and automated systems work. 
constantly adjusting state . For a state machine to work, state is only changed by monitoring input values, and not by the main loop.
The main loop ideally performs actions based only on the current state and not other factors. 

I think I did this correctly, but feel free to let me know if that isn't the case.

One note for the reader: I tried to carefully control the duration of these loops using lines like this:
codeEntryElapsedLoops * LOOP_DURATION >= CODE_ENTRY_MAX_TIME

With LOOP_DURATION of 5, and CODE_ENTRY_MAX_TIME at 3000, I would expect this to trigger after 3 seconds. 
Instead, it takes 12. In fact, this method ends up being off by a factor of 4 throughout the program.

Can you help me understand why?

Thanks for reading.

Evan
Twitter: @emwdx

*/



//Set up the names of each state to be used in the program. 
const IDLE = 0
const ENTERING_CODE = 1
const CODE_ENTERED = 2
const CODE_CORRECT = 3
const CODE_INCORRECT = 4

//These lines set up other constants for use in the program.
//The LOOP_DURATION is to try to control the amount of time for a single loop.
//As I describe above, this didn't work. 
const LOOP_DURATION = 5
const BUTTON_PRESS_DURATION = 20
const CODE_ENTRY_MAX_TIME = 3000
const IDLE_BLINK_LED_TIME = 25
const CORRECT_SEQUENCE = "ABABABBABA"
const DISPLAY_INCORRECT_CODE_DURATION = 50

//These are the global variables that change throughout the program. 
let currentState = 0
let letterSequence = ""
let buttonAPressedLoops = 0
let buttonBPressedLoops = 0
let codeEntryElapsedLoops = 0
let codeIncorrectDisplayLoopCount = 0
let idleElapsedLoops = 0

let buttonA_Released = true
let buttonB_Released = true

//This is the code that runs in a continuous loop.
basic.forever(function () {
    //Every loop, check to see if the buttons are pressed through the function checkPressedButtons.
    //This function only looks to see if either button is pressed, and if so, keeps track of for how long.
    checkPressedButtons()

    //The function evaluateButtonStatus determines if the button is pressed for long enough to register as a complete press.
    //If so, the button letter is added to the sequence of entered letters, stored in the variable letterSequence.
    evaluateButtonStatus()

    //The heaviest lifting happens in the evaluateCurrentState function. This takes all of the global variables updated
    //in the main loop and checks to see if the state needs to change in response.
    currentState = evaluateCurrentState(currentState)

    //Once the currentState has been changed (or kept the same if the state doesn't need to change), we act
    //according to the current state. Note: these cases are listed in backwards order from how they occur in the program.

    switch (currentState) {

        case CODE_ENTERED:
            //If this is the state, on the next loop, evaluateCurrentState will decide if the code is correct or incorrect.
            break;

        case CODE_CORRECT:
            //If the code entered is correct, clear the screen and show the A+ message. This is the only blocking line in the code.
            clearScreen()
            basic.showString("A")

            break;


        case CODE_INCORRECT:
            //If the code entered is incorrect, show the 'No' icon and increase the count for how long the icon has been on screen.
            codeIncorrectDisplayLoopCount += 1
            basic.showIcon(IconNames.No)

            break;

        case ENTERING_CODE:
            //If a code is being entered, clear the screen, keep track of how many loops occur while the code is being entered, and plot the
            //current sequence of loops.
            clearScreen()
            codeEntryElapsedLoops += 1
            plotCurrentSequence(letterSequence)
            break;

        default:
            //This is the starting state of the system, which is labeled as IDLE. Since IDLE is not matched by the other states, it
            //falls here.
            idleElapsedLoops += 1
            blinkIdleLight()

            break;
    }
    //Ok, technically this next line pauses the loop and makes it blocking, but that's to try to control the time of the main loop.
    //I said I almost did this completely with non-blocking code, right?
    basic.pause(LOOP_DURATION)


})

//This function decides based on a number of factors whether the state needs to change.
function evaluateCurrentState(currentState: number) {


    switch (currentState) {

        case ENTERING_CODE:
            //If a code is being entered, but the user has taken too many loops to enter it, restore the system to the IDLE state.
            if (codeEntryDurationExceeded(codeEntryElapsedLoops)) {
                clearScreen()
                resetSystem()
                return IDLE

            }
            //If a code is being entered, and the length of the entered sequence is the same as the correct sequence, change
            //the state to CODE_ENTERED.
            if (letterSequence.length == CORRECT_SEQUENCE.length) {

                return CODE_ENTERED
            }


            break;

        case CODE_ENTERED:
            //In this state, a code has been entered.
            //The function codeIsCorrect checks whether the entered code is the same as the correct sequence and returns true/false.
            let codeIsCorrect = checkEnteredCode(letterSequence)
            switch (codeIsCorrect) {

                case true:
                    //This means the code entered is correct. In the main loop, this state returns an 'A+' message.
                    return CODE_CORRECT
                    break;

                case false:
                    //This means the code entered is incorrect. In the main loop, this state returns an error message for a certain number of loops.
                    return CODE_INCORRECT

                    break;

            }

            break;

        case CODE_INCORRECT:
            //While the code entered is incorrect, check to see how many loops this state has been going on. If the time
            //exceeds the time for which this message should be displayed, restore the system to the IDLE state.
            if (codeIncorrectDisplayLoopCount * LOOP_DURATION <= DISPLAY_INCORRECT_CODE_DURATION) {
                codeIncorrectDisplayLoopCount += 1
            }
            else {
                codeIncorrectDisplayLoopCount = 0
                clearScreen()
                resetSystem()
                return IDLE
            }

            break;

        case IDLE:
            //If the system is idle, but either button has been pressed, this signals that a code is now being entered, 
            //so switch to the ENTERING_CODE state.
            if (!buttonA_Released || !buttonB_Released) {
                clearScreen()
                return ENTERING_CODE
            }

            break;



    }

    //This last line will only be called if none of the other states have been reached. 
    //Usually a switch case structure is required to be exhaustive, but I included this here just in case there was something
    //I didn't think of.
    return currentState

}

//Reset global variables that monitor user inputs.
function resetSystem() {
    clearAllLoopCounts()
    clearLetterSequence()

}

//A simple helper function named to help clarify its purpose.
function clearLetterSequence() {

    letterSequence = ""

}

//A simple helper function named to help clarify its purpose.
function clearAllLoopCounts() {

    codeEntryElapsedLoops = 0
    buttonAPressedLoops = 0;
    buttonBPressedLoops = 0;

}

//Check to see at any instant whether a button is pressed or released. If pressed, increase the pressed loop count for the corresponding button.
function checkPressedButtons() {

    if (input.buttonIsPressed(Button.A)) {
        if (buttonA_Released) {
            buttonA_Released = false
        }
        else {
            buttonAPressedLoops += 1
        }

    }
    else {

        buttonA_Released = true

    }

    if (input.buttonIsPressed(Button.B)) {
        if (buttonB_Released) {
            buttonB_Released = false
        }
        else {
            buttonBPressedLoops += 1
        }

    }
    else {

        buttonB_Released = true


    }



}

//This function checks to see if any action should be taken based on a complete button press. It only runs
//if the button has been pressed for a given amount of time and then released. This is done for both buttons.
function evaluateButtonStatus() {

    if (buttonA_Released == true && buttonAPressedLoops * LOOP_DURATION >= BUTTON_PRESS_DURATION) {

        letterSequence += "A"
        buttonAPressedLoops = 0;


    }

    if (buttonB_Released == true && buttonBPressedLoops * LOOP_DURATION >= BUTTON_PRESS_DURATION) {

        letterSequence += "B"
        buttonBPressedLoops = 0;

    }



}

//Based on the current count of loops that the system is in the ENTERING_CODE state, determine if the user is taking too long
//to enter the code.
function codeEntryDurationExceeded(codeEntryElapsedLoops: number) {
    if (codeEntryElapsedLoops * LOOP_DURATION >= CODE_ENTRY_MAX_TIME) {


        return true

    }
    else { return false }

}

//A function to determine the true or false value of whether the entered sequence is the same as the correct sequence.
function checkEnteredCode(letterSequence: string) {

    return (letterSequence == CORRECT_SEQUENCE)

}

//This function is not used in the current version, but I used it as feedback that the state was properly switching as I expected it to.
function plotCurrentState() {
    for (let i = 0; i < 3; i++) {
        led.unplot(i, 0)
    }
    led.plot(currentState, 0)
}


//Set all pixels on the screen to be dark.
function clearScreen() {
    for (let i = 0; i <= 4; i++) {
        for (let j = 0; j <= 4; j++) {

            led.unplot(i, j)


        }

    }

}

//Show the current entered sequence using two columns of LEDs on the micro:bit display.
function plotCurrentSequence(letterSequence: string) {
    //Start on the left-most column
    let currentColumn = 0
    for (let i = 0; i < letterSequence.length; i++) {

        if (i == 5) {
            //If on the sixth number, move to the right side of the display.
            currentColumn = 3
        }
        switch (letterSequence[i]) {
            //Based on the current letter in the sequence, turn on an LED on the left (for A) or right (for B)
            case "A":

                led.plot(currentColumn, i % 5)
                break;
            case "B":

                led.plot(currentColumn + 1, i % 5)
                break;

        }
    }

}

//This blinks the light in the center of the display in the IDLE state to indicate that it is waiting for the user to enter a code.
function blinkIdleLight() {
    //If the loop count times the duration of each loop is a multiple of the blink time, toggle the light.
    if (idleElapsedLoops * LOOP_DURATION % IDLE_BLINK_LED_TIME == 0) {
        led.toggle(2, 2);
        idleElapsedLoops = 0
    }
}

//One last thing - if the micro:bit is shaken, reset the system and restore the state to IDLE.

input.onGesture(Gesture.Shake, function () {
    resetSystem()
    clearScreen()
    currentState = IDLE
})
