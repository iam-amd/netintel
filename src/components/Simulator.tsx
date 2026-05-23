import { useMemo } from "react";
import {
  contributorFactors,
  defaultProfile,
  riskTier,
  type SimulatorProfile,
} from "../uiData";
import { Gauge, Icon, Pill, Slider } from "./primitives";

export function SimulatorPanel({
  profile,
  setProfile,
  probability,
}: {
  profile: SimulatorProfile;
  setProfile: (next: SimulatorProfile) => void;
  probability: number;
}) {
  const factors = useMemo(() => contributorFactors(profile), [profile]);
  const { tier, label } = riskTier(probability);
  const topFactors = [...factors].sort((a, b) => b.weight - a.weight).slice(0, 3);

  const update = <K extends keyof SimulatorProfile>(key: K) => (value: SimulatorProfile[K]) =>
    setProfile({ ...profile, [key]: value });

  return (
    <section className="panel sim-panel">
      <header className="panel-head">
        <div>
          <div className="panel-eyebrow">Simulator</div>
          <h2 className="panel-title">Customer profile</h2>
        </div>
        <div className="panel-head-meta">
          <Pill tone="neutral">Sandbox</Pill>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => setProfile(defaultProfile)}
          >
            Reset
          </button>
        </div>
      </header>

      <div className="sim-grid">
        <div className="sim-controls">
          <div className="sim-slider-grid">
            <Slider
              label="Fiber signal"
              value={profile.fiberSignal}
              min={-40}
              max={-10}
              step={1}
              unit=" dBm"
              onChange={update("fiberSignal")}
              hint="-10 dBm excellent · -30 dBm degraded"
            />
            <Slider
              label="Late payments (12 mo)"
              value={profile.latePayments}
              min={0}
              max={12}
              step={1}
              onChange={update("latePayments")}
            />
            <Slider
              label="Recent outages (30 d)"
              value={profile.recentOutages}
              min={0}
              max={20}
              step={1}
              onChange={update("recentOutages")}
            />
            <Slider
              label="Tenure"
              value={profile.monthsWithIsp}
              min={0}
              max={60}
              step={1}
              unit=" mo"
              onChange={update("monthsWithIsp")}
            />
            <Slider
              label="Support tickets (90 d)"
              value={profile.ticketsRaised}
              min={0}
              max={20}
              step={1}
              onChange={update("ticketsRaised")}
            />
          </div>

          <div className="autopay-row">
            <div>
              <div className="slider-label">Autopay enrolled</div>
              <div className="slider-hint">
                Reduces involuntary churn by ~15%
              </div>
            </div>
            <button
              type="button"
              className={`switch ${profile.autopay ? "on" : ""}`}
              onClick={() =>
                setProfile({ ...profile, autopay: !profile.autopay })
              }
              aria-pressed={profile.autopay}
            >
              <span className="switch-knob" />
            </button>
          </div>
        </div>

        <div className="sim-readout">
          <div className="readout-gauge">
            <Gauge value={probability} size={196} />
          </div>

          <div className="readout-factors">
            <div className="readout-head">
              <span className="readout-eyebrow">Top contributors</span>
              <span className={`tier-chip tier-${tier}`}>
                <Icon name="dot" size={6} /> {label}
              </span>
            </div>
            {topFactors.map((f) => (
              <div className="factor-row" key={f.key}>
                <div className="factor-label">{f.label}</div>
                <div className="factor-bar-wrap">
                  <div
                    className="factor-bar"
                    style={{ width: `${Math.max(4, f.weight * 100)}%` }}
                  />
                </div>
                <div className="factor-val">{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
