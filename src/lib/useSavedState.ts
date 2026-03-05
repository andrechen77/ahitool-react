import { useEffect, useState } from "react";

export function useSavedState<T>(
    localStorageKey: string,
    serialize: (value: T) => string,
    deserialize: (value: string) => T,
    createDefault: () => T,
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        const storedValue = localStorage.getItem(localStorageKey);
        if (storedValue) {
            return deserialize(storedValue);
        } else {
            return createDefault();
        }
    });
    useEffect(() => {
        localStorage.setItem(localStorageKey, serialize(value));
    }, [value]);
    return [value, setValue];
}
