import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { clampUpperFirst as clamp } from "../../shared/utils/format";
import { getLocaltifyPlatformInfo, type LocaltifyPlatformInfo } from "../../app/platform";
export function ToggleRow({ label, help, checked, onChange, disabled }: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="toggleRow" title={help || label}>
      <span className="toggleRowCopy">
        <span className="settingsLabelLine">
          <strong>{label}</strong>
        </span>
        {help ? <small>{help}</small> : null}
      </span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.currentTarget.checked)} />
    </label>
  );
}

export function RangeRow({ label, value, min, max, step, suffix, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [editing, setEditing] = useState(false);
  const activeValue = editing ? draftValue : value;
  const shownValue = `${activeValue}${suffix || ""}`;
  const fill = ((activeValue - min) / (max - min || 1)) * 100;

  useEffect(() => {
    if (!editing) setDraftValue(value);
  }, [editing, value]);

  function commit(nextValue = draftValue) {
    const clamped = clamp(nextValue, min, max);
    setDraftValue(clamped);
    setEditing(false);
    if (clamped !== value) onChange(clamped);
  }

  return (
    <label className="rangeRow" title={`${label}: ${shownValue}`}>
      <span className="rangeRowCopy">
        <span className="settingsLabelLine"><strong>{label}</strong></span>
        <small>{shownValue}</small>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={activeValue}
        style={{ ["--range-progress" as string]: `${clamp(fill, 0, 100)}%` } as CSSProperties}
        onPointerDown={() => { setEditing(true); setDraftValue(value); }}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          setDraftValue(nextValue);
          if (!editing) commit(nextValue);
        }}
        onPointerUp={(event) => commit(Number(event.currentTarget.value))}
        onPointerCancel={(event) => commit(Number(event.currentTarget.value))}
        onKeyUp={(event) => commit(Number(event.currentTarget.value))}
        onBlur={(event) => commit(Number(event.currentTarget.value))}
      />
    </label>
  );
}

export type ChoiceOption = { id: string; label?: string; name?: string; note?: string };
export type ThemeOption = { id: string; name: string; note?: string };
export type CustomThemeTokenOption = { key: string; label: string; help?: string; value: string };
export type CustomThemePresetOption = { id: string; name: string; note?: string; colors: { customThemeColor: string; [key: string]: string } };
export type SongLike = { id?: string; title?: string; artist?: string; album?: string; [key: string]: unknown };
export type PlatformInfoLike = Partial<LocaltifyPlatformInfo>;
export type DiagnosticsInfo = { items: Array<{ label: string; value: string | number }>; copyText: string };
export type UpdateSetting = (key: string, value: unknown) => void | Promise<void>;

export function detectSettingsPlatform(): Required<PlatformInfoLike> {
  return getLocaltifyPlatformInfo();
}
