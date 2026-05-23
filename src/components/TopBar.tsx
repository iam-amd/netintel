import { Icon } from "./primitives";

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <Icon name="logo" size={22} />
          <span className="brand-name">NetIntel</span>
          <span className="brand-sep">·</span>
          <span className="brand-product">Churn Intelligence</span>
        </div>
      </div>
    </header>
  );
}
