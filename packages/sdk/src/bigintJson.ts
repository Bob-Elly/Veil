export function stringify(obj: any): string {
    return JSON.stringify(obj, (key, value) => typeof value === 'bigint' ? value.toString() : value);
}

export function parse(str: string): any {
    return JSON.parse(str, (key, value) => {
        if (typeof value === 'string' && /^-?\d+$/.test(value)) {
            try {
                return BigInt(value);
            } catch {
                return value;
            }
        }
        return value;
    });
}
