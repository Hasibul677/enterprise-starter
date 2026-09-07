import { Button, type ButtonProps } from "./button";

export function SubmitButton({ children = "Save", ...props }: ButtonProps) {
  return (
    <Button type="submit" variant="primary" {...props}>
      {children}
    </Button>
  );
}
