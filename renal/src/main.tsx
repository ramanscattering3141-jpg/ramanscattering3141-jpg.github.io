import { render } from 'preact';
import { App } from './App';
import './app.css';
import { applyTheme, loadTheme } from './ui/mode';

// Set the colour theme before the first paint so the page does not flash.
applyTheme(loadTheme());

render(<App />, document.getElementById('app')!);
