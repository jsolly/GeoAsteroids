import jsdom from 'jsdom';
const { JSDOM } = jsdom;

const dom = new JSDOM(
  `<!DOCTYPE html><canvas height="600" width="800"></canvas>`,
);
global.document = dom.window.document;
