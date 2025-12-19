import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { CanvasState, DrawingElement } from '../models/drawing.model';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private history: CanvasState[] = [];
  private currentIndex = -1;
  private maxHistorySize = 50;

  private canUndoSubject = new BehaviorSubject<boolean>(false);
  private canRedoSubject = new BehaviorSubject<boolean>(false);

  canUndo$: Observable<boolean> = this.canUndoSubject.asObservable();
  canRedo$: Observable<boolean> = this.canRedoSubject.asObservable();

  addState(state: CanvasState): void {
    // Remove any states after current index
    this.history = this.history.slice(0, this.currentIndex + 1);
    
    // Add new state
    this.history.push(this.deepClone(state));
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    this.updateCanUndoRedo();
  }

  undo(): CanvasState | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateCanUndoRedo();
      return this.deepClone(this.history[this.currentIndex]);
    }
    return null;
  }

  redo(): CanvasState | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.updateCanUndoRedo();
      return this.deepClone(this.history[this.currentIndex]);
    }
    return null;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.updateCanUndoRedo();
  }

  private updateCanUndoRedo(): void {
    this.canUndoSubject.next(this.currentIndex > 0);
    this.canRedoSubject.next(this.currentIndex < this.history.length - 1);
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
