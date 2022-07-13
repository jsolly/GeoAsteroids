import { keyUp, keyDown } from './keybindings.mjs';
import { FPS, SAVE_KEY_MUSIC_ON, SAVE_KEY_SOUND_ON } from './constants.mjs';
import { getRoidsInfo } from './asteroids.mjs';
document.addEventListener("keydown", keyDown);
document.addEventListener("keyup", keyUp);
const toggleMusicButton = document.getElementById("toggle-music");
const toggleSoundButton = document.getElementById("toggle-sound");
toggleSoundButton.addEventListener("click", toggleSound)
toggleMusicButton.addEventListener("click", toggleMusic)

var maxStreams, vol;
const fxThrust = new Sound("sounds/thrust.m4a", maxStreams = 1, vol = 0.05);
const fxHit = new Sound("sounds/hit.m4a", maxStreams = 5, vol = 0.05);
const fxExplode = new Sound("sounds/explode.m4a", maxStreams = 1, vol = 0.05);
const fxLaser = new Sound("sounds/laser.m4a", maxStreams = 5, vol = 0.05);
const music = new Music("sounds/music-low.m4a", "sounds/music-high.m4a")
var sound_on = get_sound_preference()
var music_on = get_music_preference()


function get_sound_preference(){
    let sound_pref = localStorage.getItem(SAVE_KEY_SOUND_ON);
    if (sound_pref == null) {
        localStorage.setItem(SAVE_KEY_SOUND_ON, false); // set preference to False if not found
        return false
    }
    return (sound_pref === 'true')
}

function get_music_preference(){
    let music_pref = localStorage.getItem(SAVE_KEY_MUSIC_ON);
    if (music_pref == null) {
        localStorage.setItem(SAVE_KEY_MUSIC_ON, false); // set preference to False if not found
        return false
    }
    return (music_pref === 'true')
}

function toggleSound() {
    sound_on = !sound_on
    localStorage.setItem(SAVE_KEY_SOUND_ON, sound_on);
    document.getElementById("toggle-sound").blur();
}
function toggleMusic() {
    music_on = !music_on
    localStorage.setItem(SAVE_KEY_MUSIC_ON, music_on);
    document.getElementById("toggle-music").blur();

}

function getMusicOn(){
    return music_on
}

function Music(srcLow, srcHigh) {
    this.soundLow = new Audio(srcLow);
    this.soundHigh = new Audio(srcHigh);
    this.low = true;
    this.tempo = 1.0; // seconds per beat
    this.beatTime = 0; // the frames left before next beat

    this.play = function () {
        if (this.low) {
            this.soundLow.play()
        } else {
            this.soundHigh.play()
        }
        this.low = !this.low;
    }
    this.setAsteroidRatio = function () {
        let roidsInfo = getRoidsInfo();
        let ratio = roidsInfo.roidsLeft == 0 ? 1 : roidsInfo.roidsLeft / roidsInfo.roidsTotal //todo

        this.tempo = 1.0 - 0.75 * (1.0 - ratio);

    }

    this.tick = function () {
        if (this.beatTime == 0) {
            this.play();
            this.beatTime = Math.ceil(this.tempo * FPS);

        } else {
            this.beatTime--;
        }
    }
}

function Sound(src, maxStreams = 1, vol = 0.05) {
    this.streamNum = 0;
    this.streams = [];
    for (var i = 0; i < maxStreams; i++) {
        this.streams.push(new Audio(src));
        this.streams[i].volume = vol;

    }
    this.play = function () {
        if (sound_on) {
            this.streamNum = (this.streamNum + 1) % maxStreams;
            this.streams[this.streamNum].play();
        }
    }
    this.stop = function () {
        this.streams[this.streamNum].pause();
        this.streams[this.streamNum].currentTime = 0;
    }
}

export { Sound, Music, getMusicOn, fxThrust, fxExplode, fxHit, fxLaser, music }