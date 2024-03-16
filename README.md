# GeoAsteroids
[![GeoAsteroidsTest](https://github.com/jsolly/GeoAsteroids/actions/workflows/GeoAsteroidsTest.yml/badge.svg)](https://github.com/jsolly/GeoAsteroids/actions/workflows/GeoAsteroidsTest.yml)
[![Coverage Status](https://coveralls.io/repos/github/jsolly/GeoAsteroids/badge.svg?branch=main)](https://coveralls.io/github/jsolly/GeoAsteroids?branch=main)
[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

A 2D spaceship game, <a href="https://geoasteroids.com" target="_blank" >Geoasteroids.com</a>

![GeoAsteroids_playthrough (3)](https://user-images.githubusercontent.com/9572232/179308016-71265497-1d05-4750-bfd5-0f336cf7ae77.gif)

---

## Table of Contents

- [Installation](#installation)
- [Features](#features)
- [Contributing](#contributing)
- [Support](#support)
- [License](#license)

## Installation

1 - (Install <a href="https://nodejs.org/en/" rel="noopener noreferrer">Node.js</a>
2 - (Install <a href="https://www.mongodb.com/try/download/community" rel="noopener noreferrer">MongoDB</a>) (Or use a cloud service like <a href="https://www.mongodb.com/cloud/atlas" rel="noopener noreferrer">MongoDB Atlas</a>)

```shell
    $ git clone git@github.com:jsolly/GeoAsteroids.git
    $ cd GeoAsteroids
    $ npm install
```

## Setup

```shell
  $ cd <mongoDB_install_dir>/bin
  # Start MongoDB Server Locally (Or use a cloud service like MongoDB Atlas)
  $ ./mongod --dbpath <path to data directory>
  $ mongo # Or use a GUI like MongoDB Compass
  $ use geoasteroids
  $ db.createCollection("highscores")
  # Check src/database.ts for connection string
  $ vercel dev # Allows us to mock serverless functions locally
```

---

## Features

#### Functional

- Moving asteroids with variable jaggedness and size. Woah
- Points, lives, and levels just like you'd expect
- Spaceship with laser and thruster. Pew Pew
- Global high scoreboard so you can compete with anyone in the world!

#### Non-Functional

- Asteroid collisions detection, so you die when you're supposed to
- Static code analysis using CodeQL so the code is less likely to have security vulnerabilities
- NPM Dependency checking via Dependabot so you don't have to think about it
- 100% linted with Eslint + additional rules for a more maintainable and consistent codebase
- TypeScript under 'strict' mode with no errors, so you know we're following TS best practices
- JS bundling with Vite for a super fast front-end
- Serverless functions for API calls, so you don't have to worry too much about handling the backend
- MongoDB database for high scores cause who wants to deal with flat files?
- Custom logging library for fine-grained control of logging levels so you don't have to scratch your head about errors in production
- Over 90% test coverage so you can refactor and add features with peace of mind

## Coverage, Tests, Linting

### Coverage

```shell
npm run coverage
```

### Test

```shell
npm run test
```

### Linting (with ESlint)

```shell
npm run lint
```

---

## Contributing

Want to work on this with me? DM me on Twiiter <a href="https://twitter.com/_jsolly" target="_blank">`@_jsolly`</a>

### Step 1

- **Option 1**

  - 🍴 Fork this repo!

- **Option 2**
  - 👯 Clone to your local machine using `git@github.com:jsolly/GeoAsteroids.git`

### Step 2

- **HACK AWAY!** 🔨🔨🔨

### Step 3

- 🔃 Create a new pull request using <a href="https://github.com/jsolly/GeoAsteroids/compare" target="_blank">`https://github.com/jsolly/GeoAsteroids/compare`</a>.

---

### Top Contributors

| John Solly |
| :---:
| [![jsolly](https://avatars1.githubusercontent.com/u/9572232?v=3&s=200)](https://github.com/jsolly)
| <a href="https://github.com/jsolly" target="_blank">`github.com/jsolly`</a> |

---

## Support

Reach out to me at one of the following places!

- Twitter at <a href="https://twitter.com/_jsolly" target="_blank">`@_jsolly`</a>

---

## UML Diagram

<img src="config/geoAsteroidsUML.png" alt="GeoAsteroids UML diagram"></img>

---

## License

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

- **[MIT license](http://opensource.org/licenses/mit-license.php)**
