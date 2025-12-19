import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="app-container">
      <app-toolbar></app-toolbar>
      <app-canvas></app-canvas>
      <app-ai-chat></app-ai-chat>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      position: relative;
    }

    app-canvas {
      flex: 1;
      min-height: 0;
      display: flex;
    }
  `]
})
export class AppComponent {
  title = 'Angular Whiteboard';
}
