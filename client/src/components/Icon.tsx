import type { CSSProperties } from "react";

const paths = {
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  pantry: "M4 8h16v13H4zM3 4h18v4H3zM9 12h6",
  basket: "M3 9h18l-2 11H5L3 9Zm4 0 3-6m7 6-3-6M9 13v3m6-3v3",
  history: "M3 11a9 9 0 1 1 2.5 7M3 4v7h7m2-4v5l3 2",
  plus: "M12 5v14M5 12h14",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  back: "m15 5-7 7 7 7",
  chevron: "m9 5 7 7-7 7",
  search: "M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  filter: "M4 6h16M7 12h10m-7 6h4M8 4v4m8 2v4m-4 2v4",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  edit: "m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  calendar: "M4 5h16v16H4zM8 3v4m8-4v4M4 10h16m-12 4h2m4 0h2m-8 3h2",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 7v5l3 2",
  sparkle:
    "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3M20 3v4m-2-2h4",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  logout: "M9 4H4v16h5m6-13 5 5-5 5M9 12h11",
  leaf: "M20 3c-7 0-16 1-16 10a7 7 0 0 0 7 7c9 0 9-10 9-17ZM3 21 15 9",
  milk: "M8 3h8v4l2 3v11H6V10l2-3V3Zm0 4h8M6 11h12m-8 4h4",
  coffee:
    "M4 9h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm12 1h2a3 3 0 0 1 0 6h-2M7 2l1 4m4-4 1 4",
  grain:
    "m5 21 14-18M8 18c-5 0-6-3-5-6 4 0 6 2 5 6Zm4-5c-4 0-5-3-4-6 4 0 5 3 4 6Zm1 2c0 4 3 5 6 4 0-4-2-6-6-4Zm4-5c0 4 3 5 6 4 0-4-3-5-6-4",
  apple:
    "M12 7c-5-5-11 0-9 7 2 7 5 8 9 6 4 2 7 1 9-6 2-7-4-12-9-7Zm0 0c0-4 2-5 5-5M12 7 9 3",
  meat: "M15 3c-6-1-10 4-9 9l-4 4 2 2 2 4 4-5c5 1 10-4 9-9-1-3-2-4-4-5Zm0 4a2 2 0 1 1 0 4 2 2 0 0 1 0-4",
  snow: "M12 2v20M3 7l18 10M3 17 21 7M8 4l4 3 4-3M8 20l4-3 4 3",
  egg: "M20 14c0 5-3.5 8-8 8s-8-3-8-8S8 2 12 2s8 7 8 12ZM8 14c0 2 1 4 3 4",
  tag: "m3 3 9 0 9 9-9 9-9-9V3Zm5 4v1",
  box: "m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7 5l9 5",
  warning: "m12 3 10 18H2L12 3Zm0 6v5m0 3v1",
  hourglass: "M6 3h12M6 21h12M7 3v4l10 10v4M17 3v4L7 17v4",
  mail: "M3 5h18v14H3V5Zm0 1 9 7 9-7",
  lock: "M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4M12 14v3",
};
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  className = "",
  style,
}: {
  name: IconName;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`byb-icon ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
