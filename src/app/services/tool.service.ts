import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ToolType } from '../models/drawing.model';

@Injectable({
  providedIn: 'root'
})
export class ToolService {
  private currentToolSubject = new BehaviorSubject<ToolType>('select');
  private strokeColorSubject = new BehaviorSubject<string>('#000000');
  private fillColorSubject = new BehaviorSubject<string>('#ffffff');
  private strokeWidthSubject = new BehaviorSubject<number>(2);
  private fontSizeSubject = new BehaviorSubject<number>(16);
  private fontFamilySubject = new BehaviorSubject<string>('Arial');
  private fontWeightSubject = new BehaviorSubject<'normal' | 'bold'>('normal');
  private fontStyleSubject = new BehaviorSubject<'normal' | 'italic'>('normal');

  currentTool$: Observable<ToolType> = this.currentToolSubject.asObservable();
  strokeColor$: Observable<string> = this.strokeColorSubject.asObservable();
  fillColor$: Observable<string> = this.fillColorSubject.asObservable();
  strokeWidth$: Observable<number> = this.strokeWidthSubject.asObservable();
  fontSize$: Observable<number> = this.fontSizeSubject.asObservable();
  fontFamily$: Observable<string> = this.fontFamilySubject.asObservable();
  fontWeight$: Observable<'normal' | 'bold'> = this.fontWeightSubject.asObservable();
  fontStyle$: Observable<'normal' | 'italic'> = this.fontStyleSubject.asObservable();

  get currentTool(): ToolType {
    return this.currentToolSubject.value;
  }

  get strokeColor(): string {
    return this.strokeColorSubject.value;
  }

  get fillColor(): string {
    return this.fillColorSubject.value;
  }

  get strokeWidth(): number {
    return this.strokeWidthSubject.value;
  }

  get fontSize(): number {
    return this.fontSizeSubject.value;
  }

  get fontFamily(): string {
    return this.fontFamilySubject.value;
  }

  get fontWeight(): 'normal' | 'bold' {
    return this.fontWeightSubject.value;
  }

  get fontStyle(): 'normal' | 'italic' {
    return this.fontStyleSubject.value;
  }

  setTool(tool: ToolType): void {
    this.currentToolSubject.next(tool);
  }

  setStrokeColor(color: string): void {
    this.strokeColorSubject.next(color);
  }

  setFillColor(color: string): void {
    this.fillColorSubject.next(color);
  }

  setStrokeWidth(width: number): void {
    this.strokeWidthSubject.next(width);
  }

  setFontSize(size: number): void {
    const clamped = Math.max(8, Math.min(72, size));
    this.fontSizeSubject.next(clamped);
  }

  setFontFamily(family: string): void {
    this.fontFamilySubject.next(family || 'Arial');
  }

  toggleBold(): void {
    const next = this.fontWeightSubject.value === 'bold' ? 'normal' : 'bold';
    this.fontWeightSubject.next(next);
  }

  toggleItalic(): void {
    const next = this.fontStyleSubject.value === 'italic' ? 'normal' : 'italic';
    this.fontStyleSubject.next(next);
  }

  setFontWeight(weight: 'normal' | 'bold'): void {
    this.fontWeightSubject.next(weight);
  }

  setFontStyle(style: 'normal' | 'italic'): void {
    this.fontStyleSubject.next(style);
  }
}
