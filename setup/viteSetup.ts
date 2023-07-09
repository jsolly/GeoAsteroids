import jsdom from 'jsdom';
const { JSDOM } = jsdom;

const dom = new JSDOM(
  `<!DOCTYPE html>
<html lang="en">
  <body>
    <div id="gameWrapper">
      <div id="start-screen" class="screen">
        <h1 class="text-center fs-1">GeoAsteroids</h1>
        <ul class="nav flex-column">
          <li class="nav-item">
            <button id="start-game" class="btn btn-lg btn-primary">
              Start Game! 🚀
            </button>
          </li>
          <li class="nav-item">
            <input
              class="form-check-input"
              type="checkbox"
              value=""
              id="soundPref"
            />
            <label class="form-check-label" for="soundPref"> Sound </label>
          </li>
          <li class="nav-item">
            <input
              class="form-check-input"
              type="checkbox"
              value=""
              id="musicPref"
            />
            <label class="form-check-label" for="musicPref"> Music </label>
          </li>
        </ul>
        <h2>Difficulty</h2>
        <div
          class="btn-group"
          role="group"
          aria-label="Basic radio toggle button group"
        >
          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="easy"
            autocomplete="off"
            checked
          />
          <label class="btn btn-outline-success" for="easy">Easy</label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="medium"
            autocomplete="off"
          />
          <label class="btn btn-outline-warning" for="medium">Medium</label>

          <input
            type="radio"
            class="btn-check"
            name="btnradio"
            id="hard"
            autocomplete="off"
          />
          <label class="btn btn-outline-danger" for="hard">Hard</label>
        </div>
      </div>
      <div id="gameArea" style="display: none">
        <canvas id="gameCanvas" width="800" height="600"></canvas>
        <input type="text" id="nameInput"/>
        <button id="submitNameButton">Submit</button>
        <button id="showHighScoresButton">Show High Scores</button>
        <ol id="highScoresList"></ol>
      </div>
    </div>
  </body>
  <div id="attribution">
    <a
      href="https://www.freepik.com/free-photo/starry-night-sky_7061153.htm#query=space&position=11&from_view=search"
      >Image by kjpargeter on Freepik</a
    >
  </div>
</html>`,
);
global.document = dom.window.document;
