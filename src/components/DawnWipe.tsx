interface Props {
  show: boolean;
}

export default function DawnWipe({ show }: Props) {
  if (!show) return null;
  return (
    <div className="dawn-wipe" aria-live="polite">
      <div className="dawn-sweep" />
      <div className="dawn-sweep is-soft" />
      <div className="dawn-words">
        <span className="dawn-rule" aria-hidden="true" />
        <p className="dawn-title">天亮了。</p>
        <p className="dawn-sub">玻璃擦干净了。新的一日，从雾开始。</p>
      </div>
    </div>
  );
}
