import { useDispatch, useSelector, TypedUseSelectorHook } from "react-redux";
import type { RootState, AppDispatch } from "./index";

// Typed versions of useDispatch and useSelector.
// Use these everywhere instead of the raw react-redux versions.
// They give full TypeScript inference on state and dispatch.
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;