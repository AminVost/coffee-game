"use client";

import { useMemo } from "react";
import DatePicker, { DateObject } from "react-multi-date-picker";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import Toolbar from "react-multi-date-picker/plugins/toolbar";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import gregorianEn from "react-date-object/locales/gregorian_en";
import persianFa from "react-date-object/locales/persian_fa";
import { cn } from "@/lib/utils";

type PickerMode = "date" | "datetime";

export type PersianDatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  mode?: PickerMode;
  id?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
};

function localValueToDate(value: string, mode: PickerMode) {
  if (!value) return null;

  const pattern = mode === "datetime"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    : /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = value.match(pattern);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = mode === "datetime" ? Number(match[4]) : 0;
  const minute = mode === "datetime" ? Number(match[5]) : 0;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) return null;

  return date;
}

function selectedToLocalValue(selected: DateObject, mode: PickerMode) {
  const gregorianValue = new DateObject(selected).convert(gregorian, gregorianEn);
  return gregorianValue.format(mode === "datetime" ? "YYYY-MM-DDTHH:mm" : "YYYY-MM-DD");
}

export function PersianDatePicker({
  value,
  onChange,
  mode = "date",
  id,
  name,
  className,
  placeholder,
  required,
  disabled,
  min,
  max
}: PersianDatePickerProps) {
  const pickerValue = useMemo(() => localValueToDate(value, mode), [mode, value]);
  const minDate = useMemo(() => localValueToDate(min || "", mode), [min, mode]);
  const maxDate = useMemo(() => localValueToDate(max || "", mode), [max, mode]);
  const isDateTime = mode === "datetime";

  return (
    <DatePicker
      id={id}
      name={name}
      value={pickerValue}
      onChange={(selected) => {
        if (!selected || Array.isArray(selected)) {
          onChange("");
          return;
        }
        onChange(selectedToLocalValue(selected, mode));
      }}
      calendar={persian}
      locale={persianFa}
      format={isDateTime ? "YYYY/MM/DD - HH:mm" : "YYYY/MM/DD"}
      minDate={minDate || undefined}
      maxDate={maxDate || undefined}
      weekStartDayIndex={6}
      calendarPosition="bottom-right"
      containerClassName={cn("persian-date-picker-container", className)}
      inputClass="persian-date-picker-input"
      className="persian-date-picker-calendar"
      placeholder={placeholder || (isDateTime ? "انتخاب تاریخ و ساعت" : "انتخاب تاریخ")}
      required={required}
      disabled={disabled}
      editable={false}
      hideOnScroll
      zIndex={1200}
      inputMode="none"
      plugins={[
        ...(isDateTime
          ? [<TimePicker key="time" position="bottom" hideSeconds />]
          : []),
        <Toolbar
          key="toolbar"
          position="bottom"
          sort={["today", "deselect", "close"]}
          names={{ today: "امروز", deselect: "پاک کردن", close: "بستن" }}
        />
      ]}
    />
  );
}
