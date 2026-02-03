import { beforeAll } from 'bun:test';
import { JSDOM } from 'jsdom';

// Setup DOM environment for React Testing Library
beforeAll(() => {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost',
    pretendToBeVisual: true,
  });

  global.window = dom.window as any;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
});
