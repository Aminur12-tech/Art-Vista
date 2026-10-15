export function advanceFeeProgress(progress: number, present: boolean) {
    if (!present) return { progress, feeDue: false };
    const next = progress + 1;
    return next >= 4
        ? { progress: 0, feeDue: true }
        : { progress: next, feeDue: false };
}
