import { useEffect, useRef } from "react";
import { dawnTime, seattleDate } from "../lib/time";

interface Props {
  open: boolean;
  dawnAt: string | null;
  keeper: boolean;
  onClose: () => void;
}

export default function Help({ open, dawnAt, keeper, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const dawnLabel = dawnAt
    ? `${seattleDate(Date.parse(dawnAt))} ${dawnTime(dawnAt)}`
    : null;

  return (
    <dialog
      ref={dialogRef}
      className="help-dialog"
      aria-labelledby="help-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="help-inner">
        <div className="help-head">
          <span className="help-kicker">关于这扇窗</span>
          <button type="button" className="help-close" onClick={onClose} aria-label="合上说明，回到窗边">
            合上
          </button>
        </div>
        <h2 id="help-title">一扇朝西的雾玻璃</h2>
        <p className="help-lead">
          它面向西雅图的埃利奥特湾。窗里的人来人往，玻璃上总是蒙着一层雾。
        </p>
        <div className="help-rule" aria-hidden="true" />
        <p>雾上的字，来自路过的人。没有名字，也没有来处。</p>
        <p>
          每人每夜，只留一处：一句话，或一小笔画。天亮时，整面玻璃会被擦干净，窗上的问题也随之换新。
        </p>
        <ul className="help-list">
          <li>一句话，四十个字以内。写一句，或画一小笔，也可以两样都留下。</li>
          <li>看见不合适的话，轻声告诉守窗人。三个人指出，它便先散去。</li>
          <li>声音默认关着。想听雨时再打开。天色与雨，都来自窗外真实的西雅图。</li>
        </ul>
        {dawnLabel && (
          <p className="help-dawn">
            下一次擦窗：<time dateTime={dawnAt ?? undefined}>{dawnLabel}</time>（西雅图时间）
          </p>
        )}
        {keeper && (
          <p className="help-keeper">
            你是守窗人。轻点任一处字，可以把它擦去；窗外的人不会知道是谁擦的。
          </p>
        )}
        <div className="help-foot">
          <span>窗外的天色，取自</span>
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo
          </a>
          <span className="help-foot-rule" aria-hidden="true" />
          <span>每天天亮，重新开始。</span>
          <span className="help-sign" aria-hidden="true">雨</span>
        </div>
        <button type="button" className="help-return" onClick={onClose}>
          回到窗边
        </button>
      </div>
    </dialog>
  );
}
