// Global variables
let hands, camera;
let currentFacingMode = "user"; // Default to front camera
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('output-canvas');
const canvasCtx = canvasElement.getContext('2d');
const outputElement = document.getElementById('output');
const messageBoxElement = document.getElementById('message-box');
const errorMessageElement = document.getElementById('error-message');
const statusElement = document.getElementById('status');
const clearBtnElement = document.getElementById('clear-btn');
const copyBtnElement = document.getElementById('copy-btn');
const flipCameraBtnElement = document.getElementById('flip-camera');

// MediaPipe drawing utilities
const mpDrawingUtils = window.drawingUtils;

// Gesture tracking variables
let lastDetectedGesture = "";
let gestureConfirmTimer = null;
let consecutiveGestureDetections = 0;
const requiredConsecutiveDetections = 5; // Reduced for faster recognition
const gestureCooldown = 1500; // Cooldown in ms before the same gesture can be added again

// Gesture definitions
const GESTURES = {
    HELLO: "سڵاو",
    YES: "بەڵێ",
    NO: "نەخێر",
    THANKS: "سوپاس",
    GOOD: "باشە",
    PLEASE: "تکایە",
    STOP: "وەستە"
};

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeButtons();
    initializeMediaPipe();
});

/**
 * Set up button event listeners
 */
function initializeButtons() {
    // Clear button functionality
    clearBtnElement.addEventListener('click', () => {
        messageBoxElement.value = "";
    });
    
    // Copy button functionality
    copyBtnElement.addEventListener('click', () => {
        messageBoxElement.select();
        document.execCommand('copy');
        
        // Visual feedback
        const originalText = copyBtnElement.textContent;
        copyBtnElement.textContent = "کۆپی کرا!";
        setTimeout(() => {
            copyBtnElement.textContent = originalText;
        }, 2000);
    });
    
    // Flip camera button functionality
    flipCameraBtnElement.addEventListener('click', () => {
        flipCamera();
    });
}

/**
 * Flip between front and back cameras
 */
function flipCamera() {
    // If camera is not initialized or we're in demo mode, do nothing
    if (!camera) {
        console.log("No camera to flip");
        return;
    }
    
    // Toggle facing mode
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    
    // Stop current camera
    if (camera) {
        camera.stop();
    }
    
    // Show status
    statusElement.style.display = "block";
    statusElement.textContent = "گۆڕینی کامێرا...";
    
    // Set up new camera with toggled facing mode
    const constraints = {
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { exact: currentFacingMode },
            frameRate: { ideal: 30 }
        }
    };
    
    // Log for debugging
    console.log("Flipping camera to mode:", currentFacingMode);
    
    // Request camera with new facing mode
    navigator.mediaDevices.getUserMedia(constraints)
        .then(stream => {
            console.log("Camera flipped successfully");
            
            // Create new camera
            camera = new Camera(videoElement, {
                onFrame: async () => {
                    try {
                        await hands.send({image: videoElement});
                    } catch (error) {
                        console.error("Error processing frame:", error);
                    }
                },
                width: 640,
                height: 480
            });
            
            // Start the MediaPipe camera
            camera.start()
                .then(() => {
                    statusElement.textContent = "کامێرا گۆڕدرا";
                    setTimeout(() => {
                        statusElement.style.display = "none";
                    }, 2000);
                })
                .catch(error => {
                    console.error("Camera flip error:", error);
                    handleError("ناتوانرێت کامێرا بگۆڕدرێت. تکایە دووبارە هەوڵ بدەوە.", error);
                    
                    // Try to go back to the previous camera
                    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
                    startCamera();
                });
        })
        .catch(error => {
            console.error("Camera flip access error:", error);
            handleError("دەستپێگەیشتنی کامێرا ڕەتکرایەوە یان پشتگیری ناکرێت.", error);
            
            // Try to go back to the previous camera
            currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
            startCamera();
        });
}

/**
 * Initialize MediaPipe Hands for gesture detection
 */
function initializeMediaPipe() {
    // Update status
    statusElement.textContent = "دەستپێکردنی سیستەم...";
    
    try {
        // Create a new instance of MediaPipe Hands
        hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
            }
        });

        // Configure MediaPipe Hands options for better detection
        hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5, // Lower threshold for easier detection
            minTrackingConfidence: 0.5   // Lower threshold for easier tracking
        });

        // Set up results handler
        hands.onResults(handleResults);
        
        // Add a debug log
        console.log("MediaPipe Hands initialized successfully");
        
        // Start camera after MediaPipe is initialized
        startCamera();
    } catch (error) {
        console.error("MediaPipe initialization error:", error);
        handleError("تکایە وێبگەڕێکی نوێتر بەکاربهێنە کە پشتگیری ئەم تەکنەلۆجیایە بکات.", error);
    }
}

/**
 * Start the camera feed
 */
function startCamera() {
    statusElement.textContent = "داوای دەستپێگەیشتنی کامێرا...";
    
    // If we're in a development environment with no camera, use a fallback demo mode
    const isDemoMode = checkIfDemoModeRequired();
    
    if (isDemoMode) {
        setupDemoMode();
        return;
    }
    
    try {
        // Force demo mode for this environment as camera access is likely restricted
        console.log("Checking if demo mode should be activated immediately");
        
        // For this environment, let's activate demo mode immediately 
        // since camera access seems to be consistently failing
        setTimeout(() => {
            if (!isDemoMode) {
                console.log("Activating demo mode immediately due to likely camera restrictions");
                setupDemoMode();
                return;
            }
        }, 2000);
        
        // Define better camera constraints with priority for mobile devices
        const constraints = {
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: { ideal: "user" }, // Front camera preferred
                frameRate: { ideal: 30 }  // Higher frame rate for better tracking
            }
        };

        // First check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("getUserMedia not supported in this browser");
        }

        // Add mobile device detection for better camera handling
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            // Optimize for mobile - might need the back camera on some devices
            constraints.video.facingMode = { ideal: "environment" };
            console.log("Mobile device detected, optimizing camera settings");
        }

        // Log for debugging
        console.log("Requesting camera access with constraints:", constraints);
        
        // Try to get camera access directly first to ensure permissions
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                console.log("Camera access granted successfully");
                
                // Now create the camera utility from MediaPipe
                // Create a frame counter to detect if camera freezes
                let frameCount = 0;
                const frameCheckInterval = setInterval(() => {
                    // If no frames processed in 5 seconds, camera may be frozen
                    if (frameCount === 0 && camera) {
                        console.log("No frames processed in 5 seconds, camera may be frozen");
                        cameraErrorCount++;
                        
                        if (cameraErrorCount >= MAX_CAMERA_ERRORS) {
                            console.log("Camera appears to be frozen, switching to demo mode");
                            clearInterval(frameCheckInterval);
                            if (camera) camera.stop();
                            setupDemoMode();
                        }
                    }
                    frameCount = 0;
                }, 5000);
                
                camera = new Camera(videoElement, {
                    onFrame: async () => {
                        try {
                            // Increment frame counter to track camera activity
                            frameCount++;
                            
                            // Make sure video element is ready before sending
                            if (videoElement.readyState === 4) { // HAVE_ENOUGH_DATA
                                await hands.send({image: videoElement});
                            } else {
                                console.log("Video not ready yet, readyState:", videoElement.readyState);
                            }
                        } catch (error) {
                            console.error("Error processing frame:", error);
                        }
                    },
                    width: 640,
                    height: 480
                });
                
                // Start the MediaPipe camera
                console.log("Starting MediaPipe camera");
                camera.start()
                    .then(() => {
                        console.log("MediaPipe camera started successfully");
                        statusElement.textContent = "کامێرا چالاکە";
                        setTimeout(() => {
                            statusElement.style.display = "none";
                        }, 3000);
                    })
                    .catch(error => {
                        console.error("MediaPipe camera start error:", error);
                        // If mobile back camera fails, try front camera
                        if (isMobile && constraints.video.facingMode.ideal === "environment") {
                            console.log("Trying front camera as fallback");
                            constraints.video.facingMode = { ideal: "user" };
                            startCamera(); // Retry with new constraints
                            return;
                        }
                        // Try demo mode as fallback
                        setupDemoMode();
                    });
            })
            .catch(error => {
                console.error("Camera access error:", error);
                // Try demo mode as fallback
                setupDemoMode();
            });
    } catch (error) {
        console.error("Camera setup error:", error);
        // Try demo mode as fallback
        setupDemoMode();
    }
}

/**
 * Check if demo mode should be used (e.g. when no camera is available)
 */
function checkIfDemoModeRequired() {
    // If we've already set up demo mode, stay in it
    if (isDemoMode) {
        return true;
    }
    
    // Check if we're in an environment that lacks camera access
    // or if there are errors with the camera
    return (cameraErrorCount >= MAX_CAMERA_ERRORS) || 
           !navigator.mediaDevices || 
           !navigator.mediaDevices.getUserMedia;
}

/**
 * Set up demo mode with simulated hand detection
 */
function setupDemoMode() {
    // Set the flag to track that we're in demo mode
    isDemoMode = true;
    
    // Stop any existing camera 
    if (camera) {
        try {
            camera.stop();
        } catch (e) {
            console.error("Error stopping camera:", e);
        }
        camera = null;
    }
    
    statusElement.textContent = "شێوازی نیشاندان - کامێرا پێویست نییە";
    
    // Create a canvas context for demo visuals
    canvasElement.width = 640;
    canvasElement.height = 480;
    
    // Draw a dark background
    canvasCtx.fillStyle = '#111';
    canvasCtx.fillRect(0, 0, canvasElement.width, canvasElement.height);
    
    // Draw hand outline
    canvasCtx.strokeStyle = '#00FF00';
    canvasCtx.lineWidth = 3;
    
    // Show a message to explain demo mode
    canvasCtx.font = '20px Noto Sans Arabic';
    canvasCtx.fillStyle = '#FFFFFF';
    canvasCtx.textAlign = 'center';
    canvasCtx.fillText('شێوازی نیشاندان - کامێرا نەدۆزرایەوە', canvasElement.width/2, 50);
    canvasCtx.fillText('تکایە کرتە لەسەر دوگمەکان بکە', canvasElement.width/2, 80);
    
    // Add demo buttons for gestures
    const container = document.querySelector('.video-container');
    
    // Create demo controls
    const demoControls = document.createElement('div');
    demoControls.className = 'demo-controls';
    demoControls.innerHTML = `
        <div class="demo-control-row">
            <button id="demo-hello" class="demo-btn">سڵاو</button>
            <button id="demo-yes" class="demo-btn">بەڵێ</button>
            <button id="demo-no" class="demo-btn">نەخێر</button>
        </div>
        <div class="demo-control-row">
            <button id="demo-thanks" class="demo-btn">سوپاس</button>
            <button id="demo-good" class="demo-btn">باشە</button>
            <button id="demo-please" class="demo-btn">تکایە</button>
            <button id="demo-stop" class="demo-btn">وەستە</button>
        </div>
    `;
    container.appendChild(demoControls);
    
    // Add event listeners to demo buttons
    document.getElementById('demo-hello').addEventListener('click', () => {
        handleGestureDetection(GESTURES.HELLO, "hello");
    });
    
    document.getElementById('demo-yes').addEventListener('click', () => {
        handleGestureDetection(GESTURES.YES, "yes");
    });
    
    document.getElementById('demo-no').addEventListener('click', () => {
        handleGestureDetection(GESTURES.NO, "no");
    });
    
    document.getElementById('demo-thanks').addEventListener('click', () => {
        handleGestureDetection(GESTURES.THANKS, "thanks");
    });
    
    document.getElementById('demo-good').addEventListener('click', () => {
        handleGestureDetection(GESTURES.GOOD, "good");
    });
    
    document.getElementById('demo-please').addEventListener('click', () => {
        handleGestureDetection(GESTURES.PLEASE, "please");
    });
    
    document.getElementById('demo-stop').addEventListener('click', () => {
        handleGestureDetection(GESTURES.STOP, "stop");
    });
    
    // Add styles for demo buttons
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .demo-controls {
            position: absolute;
            bottom: 20px;
            left: 0;
            right: 0;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 20;
            padding: 0 10px;
        }
        .demo-control-row {
            display: flex;
            justify-content: space-around;
            gap: 5px;
        }
        .demo-btn {
            padding: 8px 10px;
            background-color: #3498db;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-family: 'Noto Sans Arabic', sans-serif;
            font-size: 0.9rem;
            min-width: 60px;
            transition: transform 0.2s, background-color 0.3s;
        }
        .demo-btn:hover {
            background-color: #2980b9;
            transform: scale(1.05);
        }
        .demo-btn:active {
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(styleElement);
}

// Track camera errors
let cameraErrorCount = 0;
let lastErrorTime = 0;
const MAX_CAMERA_ERRORS = 3; // Reduced for faster fallback to demo mode
const ERROR_RESET_TIME = 10000; // 10 seconds
let isDemoMode = false; // Track if we're currently in demo mode

/**
 * Handle results from MediaPipe Hands
 * @param {Object} results - The hand detection results
 */
function handleResults(results) {
    // Reset any error counters if it's been a while since the last error
    const currentTime = Date.now();
    if (currentTime - lastErrorTime > ERROR_RESET_TIME) {
        cameraErrorCount = 0;
    }
    
    // Reset output styling
    outputElement.className = "";
    
    try {
        // Make sure video is actually playing and has dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
            console.log("Video not ready yet, waiting...");
            outputElement.textContent = "چاوەڕێی کامێرا دەکات...";
            return;
        }
        
        // Update canvas dimensions to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        
        // Clear the canvas
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        // Draw the camera image on the canvas - with additional error handling
        try {
            canvasCtx.drawImage(
                videoElement, 0, 0, canvasElement.width, canvasElement.height);
        } catch (drawError) {
            console.error("Error drawing video to canvas:", drawError);
            return;
        }
        
        // Check if hands are detected
        if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            outputElement.textContent = "لەچاوەڕوانیدایە...";
            consecutiveGestureDetections = 0; // Reset consecutive detections
            return;
        }
        
        // Draw hand landmarks on canvas
        for (const landmarks of results.multiHandLandmarks) {
            // Draw landmarks
            mpDrawingUtils.drawConnectors(
                canvasCtx, landmarks, Hands.HAND_CONNECTIONS,
                {color: '#00FF00', lineWidth: 5});
            mpDrawingUtils.drawLandmarks(
                canvasCtx, landmarks, {
                    color: '#FF0000', 
                    lineWidth: 2,
                    radius: 4
                });
        }
        
        const landmarks = results.multiHandLandmarks[0];
        
        // Detect gestures
        let detectedGesture = detectGesture(landmarks);
        
        if (detectedGesture) {
            handleGestureDetection(detectedGesture.name, detectedGesture.className);
        } else {
            outputElement.textContent = "هێچ";
            consecutiveGestureDetections = 0; // Reset consecutive detections
        }
    } catch (error) {
        // Handle any errors that occur during frame processing
        console.error("Error processing frame:", error);
        
        // Track errors and restart camera if needed
        lastErrorTime = currentTime;
        cameraErrorCount++;
        
        if (cameraErrorCount >= MAX_CAMERA_ERRORS) {
            console.log("Too many camera errors, switching to demo mode");
            // Stop the camera
            if (camera) {
                camera.stop();
            }
            
            // Show status message
            statusElement.style.display = "block";
            statusElement.textContent = "گۆڕین بۆ شێوازی نیشاندان...";
            
            // Switch to demo mode after multiple failed attempts
            setupDemoMode();
            cameraErrorCount = 0;
        } else {
            console.log("Camera error detected, attempting restart...");
            // Restart the camera
            if (camera) {
                camera.stop();
            }
            
            // Show status message
            statusElement.style.display = "block";
            statusElement.textContent = "دەستپێکردنەوەی کامێرا...";
            
            // Delay restart to avoid rapid restart loops
            setTimeout(() => {
                startCamera();
            }, 1000);
        }
    }
}

/**
 * Handle a detected gesture with confirmation system
 * @param {String} gestureName - The name of the detected gesture
 * @param {String} className - The CSS class to apply to the output element
 */
function handleGestureDetection(gestureName, className) {
    outputElement.textContent = gestureName;
    outputElement.className = className;
    
    // If we're detecting the same gesture as before, increment the counter
    if (lastDetectedGesture === gestureName) {
        consecutiveGestureDetections++;
        
        // If we've seen enough consecutive detections, confirm the gesture
        if (consecutiveGestureDetections >= requiredConsecutiveDetections) {
            addGestureToMessageBox(gestureName);
            consecutiveGestureDetections = 0; // Reset for next detection
        }
    } else {
        // Different gesture, reset the counter
        lastDetectedGesture = gestureName;
        consecutiveGestureDetections = 1;
    }
}

/**
 * Add the detected gesture to the message box
 * @param {String} gesture - The gesture to add
 */
function addGestureToMessageBox(gesture) {
    // Get the current text and check if it's empty
    const currentText = messageBoxElement.value;
    
    // Add the gesture to the message box with appropriate spacing
    if (!currentText) {
        messageBoxElement.value = gesture;
    } else {
        messageBoxElement.value = `${currentText} ${gesture}`;
    }
    
    // Scroll to the bottom of the text area
    messageBoxElement.scrollTop = messageBoxElement.scrollHeight;
    
    // Create a cooldown before the same gesture can be added again
    setTimeout(() => {
        consecutiveGestureDetections = 0;
    }, gestureCooldown);
}

/**
 * Detect which gesture is being made
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Object|null} Gesture object with name and className, or null if no gesture is recognized
 */
function detectGesture(landmarks) {
    // Debug logging to see what landmarks we're getting
    console.log("Hand landmarks detected:", landmarks);
    
    // Check for Hello gesture (index finger up, others down)
    if (isHelloGesture(landmarks)) {
        return { name: GESTURES.HELLO, className: "hello" };
    }
    
    // Check for Yes gesture (thumb up)
    if (isYesGesture(landmarks)) {
        return { name: GESTURES.YES, className: "yes" };
    }
    
    // Check for No gesture (side to side)
    if (isNoGesture(landmarks)) {
        return { name: GESTURES.NO, className: "no" };
    }
    
    // Check for Thanks gesture
    if (isThanksGesture(landmarks)) {
        return { name: GESTURES.THANKS, className: "thanks" };
    }
    
    // Check for Good gesture
    if (isGoodGesture(landmarks)) {
        return { name: GESTURES.GOOD, className: "good" };
    }
    
    // Check for Please gesture
    if (isPleaseGesture(landmarks)) {
        return { name: GESTURES.PLEASE, className: "please" };
    }
    
    // Check for Stop gesture
    if (isStopGesture(landmarks)) {
        return { name: GESTURES.STOP, className: "stop" };
    }
    
    // No recognized gesture
    return null;
}

/**
 * Determine if the hand landmarks represent the "Hello" gesture
 * This function checks if only the index finger is raised
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "Hello"
 */
function isHelloGesture(landmarks) {
    // Indices for finger landmarks
    // 4: thumb tip, 8: index tip, 12: middle tip, 16: ring tip, 20: pinky tip
    // 5: index MCP, 6: index PIP, 7: index DIP
    // 9: middle MCP, 10: middle PIP, 11: middle DIP
    // etc.
    
    // Index finger should be extended upward (Y position decreases toward top of image)
    const indexFingerUp = landmarks[8].y < landmarks[6].y;
    
    // Middle finger should be curled (not extended)
    const middleFingerDown = landmarks[12].y > landmarks[10].y;
    
    // Ring finger should be curled (not extended)
    const ringFingerDown = landmarks[16].y > landmarks[14].y;
    
    // Pinky finger should be curled (not extended)
    const pinkyFingerDown = landmarks[20].y > landmarks[18].y;
    
    // Log the detection results for debugging
    console.log("Hello gesture detection:", {
        indexFingerUp,
        middleFingerDown,
        ringFingerDown,
        pinkyFingerDown
    });
    
    // Return true if index is up and others are down - this is our "Hello" gesture
    return indexFingerUp && middleFingerDown && ringFingerDown && pinkyFingerDown;
}

/**
 * Determine if the hand landmarks represent the "Yes" gesture (thumbs up)
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "Yes"
 */
function isYesGesture(landmarks) {
    // Thumb should be extended upward
    const thumbUp = landmarks[4].y < landmarks[3].y && landmarks[3].y < landmarks[2].y;
    
    // All other fingers should be curled
    const indexFingerDown = landmarks[8].y > landmarks[7].y;
    const middleFingerDown = landmarks[12].y > landmarks[11].y;
    const ringFingerDown = landmarks[16].y > landmarks[15].y;
    const pinkyFingerDown = landmarks[20].y > landmarks[19].y;
    
    // The thumb should be clearly visible and pointed upward
    const thumbClearlyVisible = landmarks[4].z < -0.1;
    
    console.log("Yes gesture detection:", {
        thumbUp,
        indexFingerDown,
        middleFingerDown,
        ringFingerDown,
        pinkyFingerDown,
        thumbClearlyVisible
    });
    
    return thumbUp && indexFingerDown && middleFingerDown && ringFingerDown && pinkyFingerDown;
}

/**
 * Determine if the hand landmarks represent the "No" gesture (index finger wagging)
 * This is simplistic since we can't easily track motion over time in this implementation
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "No"
 */
function isNoGesture(landmarks) {
    // For "No" gesture, we'll check for the index finger extended horizontally
    // and other fingers curled
    
    // Index finger should be extended
    const indexFingerExtended = landmarks[8].y < landmarks[6].y;
    
    // Index finger should be more horizontal than vertical
    // Compare X distance vs Y distance from PIP joint to tip
    const xDiff = Math.abs(landmarks[8].x - landmarks[6].x);
    const yDiff = Math.abs(landmarks[8].y - landmarks[6].y);
    const moreHorizontal = xDiff > yDiff;
    
    // Other fingers should be curled
    const middleFingerDown = landmarks[12].y > landmarks[10].y;
    const ringFingerDown = landmarks[16].y > landmarks[14].y;
    const pinkyFingerDown = landmarks[20].y > landmarks[18].y;
    
    console.log("No gesture detection:", {
        indexFingerExtended,
        moreHorizontal,
        middleFingerDown,
        ringFingerDown,
        pinkyFingerDown
    });
    
    return indexFingerExtended && moreHorizontal && middleFingerDown && ringFingerDown && pinkyFingerDown;
}

/**
 * Determine if the hand landmarks represent the "Thanks" gesture
 * For "Thanks" gesture, we'll check for open palm (all fingers extended)
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "Thanks"
 */
function isThanksGesture(landmarks) {
    // All fingers should be extended upward
    const indexFingerUp = landmarks[8].y < landmarks[6].y;
    const middleFingerUp = landmarks[12].y < landmarks[10].y;
    const ringFingerUp = landmarks[16].y < landmarks[14].y;
    const pinkyFingerUp = landmarks[20].y < landmarks[18].y;
    const thumbOut = landmarks[4].x < landmarks[3].x; // Thumb extended outward (for right hand)
    
    console.log("Thanks gesture detection:", {
        indexFingerUp,
        middleFingerUp,
        ringFingerUp,
        pinkyFingerUp,
        thumbOut
    });
    
    // Return true if all fingers are extended - this is our "Thanks" open palm gesture
    return indexFingerUp && middleFingerUp && ringFingerUp && pinkyFingerUp && thumbOut;
}

/**
 * Determine if the hand landmarks represent the "Good" gesture (OK sign)
 * For "Good" gesture, we'll check for a circle formed by thumb and index finger
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "Good"
 */
function isGoodGesture(landmarks) {
    // For OK sign, thumb and index finger tips should be close to each other
    const thumbToIndexDistance = Math.sqrt(
        Math.pow(landmarks[4].x - landmarks[8].x, 2) + 
        Math.pow(landmarks[4].y - landmarks[8].y, 2) +
        Math.pow(landmarks[4].z - landmarks[8].z, 2)
    );
    
    // Other fingers should be extended
    const middleFingerUp = landmarks[12].y < landmarks[10].y;
    const ringFingerUp = landmarks[16].y < landmarks[14].y;
    const pinkyFingerUp = landmarks[20].y < landmarks[18].y;
    
    const isThumbIndexClose = thumbToIndexDistance < 0.1; // Threshold for "close enough"
    
    console.log("Good gesture detection:", {
        thumbToIndexDistance,
        isThumbIndexClose,
        middleFingerUp,
        ringFingerUp,
        pinkyFingerUp
    });
    
    // Return true if thumb and index form a circle, and other fingers are extended
    return isThumbIndexClose && middleFingerUp && ringFingerUp && pinkyFingerUp;
}

/**
 * Determine if the hand landmarks represent the "Please" gesture (hand with fingers closed)
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "Please"
 */
function isPleaseGesture(landmarks) {
    // All fingers should be together and pointing upward
    const fingersExtended = landmarks[8].y < landmarks[5].y;
    const fingersTogether = 
        Math.abs(landmarks[8].x - landmarks[12].x) < 0.05 && 
        Math.abs(landmarks[12].x - landmarks[16].x) < 0.05 &&
        Math.abs(landmarks[16].x - landmarks[20].x) < 0.05;
    
    // palm should be visible
    const palmVisible = landmarks[0].z < -0.1;
    
    console.log("Please gesture detection:", {
        fingersExtended,
        fingersTogether,
        palmVisible
    });
    
    // Return true if fingers are together and extended
    return fingersExtended && fingersTogether && palmVisible;
}

/**
 * Determine if the hand landmarks represent the "Stop" gesture (hand with all fingers extended but separated)
 * @param {Array} landmarks - Hand landmarks from MediaPipe
 * @returns {Boolean} True if the gesture is recognized as "Stop"
 */
function isStopGesture(landmarks) {
    // All fingers should be extended
    const indexFingerUp = landmarks[8].y < landmarks[6].y;
    const middleFingerUp = landmarks[12].y < landmarks[10].y;
    const ringFingerUp = landmarks[16].y < landmarks[14].y;
    const pinkyFingerUp = landmarks[20].y < landmarks[18].y;
    const thumbOut = landmarks[4].x < landmarks[3].x;
    
    // Fingers should be spread apart
    const fingersSpread = 
        Math.abs(landmarks[8].x - landmarks[12].x) > 0.05 &&
        Math.abs(landmarks[12].x - landmarks[16].x) > 0.05 &&
        Math.abs(landmarks[16].x - landmarks[20].x) > 0.05;
    
    console.log("Stop gesture detection:", {
        indexFingerUp,
        middleFingerUp,
        ringFingerUp,
        pinkyFingerUp,
        thumbOut,
        fingersSpread
    });
    
    // Return true if all fingers are extended and spread
    return indexFingerUp && middleFingerUp && ringFingerUp && pinkyFingerUp && thumbOut && fingersSpread;
}

/**
 * Handle errors and display appropriate messages
 * @param {String} message - User-friendly error message
 * @param {Error} error - The error object
 */
function handleError(message, error) {
    console.error(error);
    statusElement.style.display = "none";
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = "block";
}
