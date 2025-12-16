import { useRef, useState } from "react";

interface Props {
  length?: number; // number of boxes
  onChange?: (code: string) => void; // callback to parent (optional)
}

export default function CodeInputs({ length = 6, onChange }: Props) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const updateCode = (arr: string[]) => {
    const code = arr.join("");
    if (onChange) onChange(code);
  };

  const handleInput = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;

    if (isNaN(Number(value))) {
      e.target.value = "";
      return;
    }

    const newValues = [...values];
    newValues[index] = value;
    setValues(newValues);
    updateCode(newValues);

    if (value !== "" && inputsRef.current[index + 1]) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyUp = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    const key = e.key.toLowerCase();

    if (key === "backspace" || key === "delete") {
      const newValues = [...values];
      newValues[index] = "";
      setValues(newValues);
      updateCode(newValues);

      if (inputsRef.current[index - 1]) {
        inputsRef.current[index - 1]?.focus();
      }
    }
  };

  return (
    <div className="auth__verification--inputs">
      {Array.from({ length }).map((_, i) => (
        <input
          className="auth__verification--input auth__form--input"
          key={i}
          maxLength={1}
          type="text"
          ref={(el) => {
            inputsRef.current[i] = el;
          }}
          value={values[i]}
          onInput={(e: React.ChangeEvent<HTMLInputElement>) => handleInput(i, e)}
          onKeyUp={(e: React.KeyboardEvent<HTMLInputElement>) => handleKeyUp(i, e)}
        />
      ))}
    </div>
  );
}
