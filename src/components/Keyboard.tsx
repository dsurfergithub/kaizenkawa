import { useRef } from 'react';
import { isBlackKey, noteName } from '../notes';

interface Props {
  low: number;
  high: number;
  onNoteOn: (note: number) => void;
  onNoteOff: (note: number) => void;
  disabled?: boolean;
}

/** Teclado táctil con soporte multi-touch y glissando. */
export default function Keyboard({ low, high, onNoteOn, onNoteOff, disabled }: Props) {
  const activeByPointer = useRef(new Map<number, number>());
  const notes: number[] = [];
  for (let n = low; n <= high; n++) notes.push(n);
  const whites = notes.filter((n) => !isBlackKey(n));

  const press = (pointerId: number, note: number) => {
    const prev = activeByPointer.current.get(pointerId);
    if (prev === note) return;
    if (prev !== undefined) onNoteOff(prev);
    activeByPointer.current.set(pointerId, note);
    onNoteOn(note);
  };

  const release = (pointerId: number) => {
    const note = activeByPointer.current.get(pointerId);
    if (note !== undefined) {
      activeByPointer.current.delete(pointerId);
      onNoteOff(note);
    }
  };

  const noteFromEvent = (e: React.PointerEvent): number | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const attr = el?.getAttribute('data-note');
    return attr ? Number(attr) : null;
  };

  const handlers = disabled
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent) => {
          const note = noteFromEvent(e);
          if (note !== null) press(e.pointerId, note);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (!activeByPointer.current.has(e.pointerId)) return;
          const note = noteFromEvent(e);
          if (note !== null) press(e.pointerId, note);
        },
        onPointerUp: (e: React.PointerEvent) => release(e.pointerId),
        onPointerCancel: (e: React.PointerEvent) => release(e.pointerId),
        onPointerLeave: (e: React.PointerEvent) => release(e.pointerId),
      };

  const whiteWidth = 100 / whites.length;

  return (
    <div className={`keyboard${disabled ? ' keyboard--disabled' : ''}`} {...handlers}>
      {whites.map((n) => (
        <div key={n} data-note={n} className="key key--white" style={{ width: `${whiteWidth}%` }}>
          <span>{n % 12 === 0 ? noteName(n) : ''}</span>
        </div>
      ))}
      {notes
        .filter((n) => isBlackKey(n))
        .map((n) => {
          const whitesBefore = whites.filter((w) => w < n).length;
          return (
            <div
              key={n}
              data-note={n}
              className="key key--black"
              style={{ left: `${whitesBefore * whiteWidth - whiteWidth * 0.3}%`, width: `${whiteWidth * 0.6}%` }}
            />
          );
        })}
    </div>
  );
}
