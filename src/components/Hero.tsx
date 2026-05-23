import { Fragment, type CSSProperties } from "react";

export function Hero() {
  const titleLines: string[][] = [
    ["Predict", "churn", "before"],
    ["it", "happens."],
  ];
  let idx = 0;
  let nextDelay = 120;

  return (
    <section className="hero">
      <div
        className="hero-eyebrow hero-anim"
        style={{ "--d": "0ms" } as CSSProperties}
      >
        NetIntel · Churn Intelligence
      </div>
      <h1 className="hero-title">
        {titleLines.map((line, li) => (
          <span className="hero-line" key={li}>
            {line.map((word, wi) => {
              const delay = nextDelay + idx * 70;
              idx++;
              return (
                <Fragment key={wi}>
                  <span className="hero-word-wrap">
                    <span
                      className="hero-word hero-anim"
                      style={{ "--d": `${delay}ms` } as CSSProperties}
                    >
                      {word}
                    </span>
                  </span>
                  {wi < line.length - 1 ? " " : ""}
                </Fragment>
              );
            })}
          </span>
        ))}
      </h1>
      <p
        className="hero-sub hero-anim"
        style={
          { "--d": `${nextDelay + idx * 70 + 60}ms` } as CSSProperties
        }
      >
        Spot at-risk subscribers, simulate the impact of an intervention, and
        act before they leave — all from one place.
      </p>
    </section>
  );
}
