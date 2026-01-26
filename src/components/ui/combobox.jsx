/* eslint-disable react/prop-types */
import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";

const Combobox = React.forwardRef(({ options = [], value, onValueChange, placeholder = "Select...", disabled = false }, ref) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(
    () =>
      options.filter((option) =>
        option.label.toLowerCase().includes(search.toLowerCase())
      ),
    [options, search]
  );

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className="relative w-full" ref={ref}>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="justify-between w-full h-10"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen(!open);
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
      </Button>

      {open && (
        <div className="absolute z-50 w-full p-2 mt-2 border rounded-md shadow-md bg-popover">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />
          <div className="space-y-1 overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <div className="p-2 text-sm text-center text-muted-foreground">
                No results found
              </div>
            ) : (
              filtered.map((option) => (
                <Button
                  key={option.value}
                  variant="ghost"
                  className="justify-start w-full font-normal"
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </Button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
});

Combobox.displayName = "Combobox";

export { Combobox };
