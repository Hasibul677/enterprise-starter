import { Button, type ButtonProps } from "./button";

/** Thin semantic alias so form-submit call sites read clearly; identical behavior to <Button loading />. */
export function LoadingButton(props: ButtonProps) {
  return <Button {...props} />;
}
