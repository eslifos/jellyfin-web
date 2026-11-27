/**
 * A small QR code encoder (ISO/IEC 18004): byte mode, error correction level M, versions 1 to 10 (up to 213 bytes),
 * which is all the app needs (a sign-in address to scan with a phone). Follows the reference algorithm of the
 * standard: data and error correction codewords (Reed-Solomon over GF(256)), interleaved in blocks, the function
 * patterns, the data in zigzag, and the mask with the lowest penalty.
 */

/** Error correction codewords per block, level M, versions 1 to 10. */
const ECC_PER_BLOCK = [ 10, 16, 26, 18, 24, 16, 18, 22, 22, 26 ];
/** Error correction blocks, level M, versions 1 to 10. */
const BLOCKS = [ 1, 1, 1, 2, 2, 4, 4, 4, 5, 5 ];
const MAX_VERSION = 10;
/** Level M in the format information. */
const FORMAT_LEVEL_M = 0;

/** Product in GF(256) with the polynomial of QR codes (0x11D). */
export const gfMultiply = (x: number, y: number) => {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
};

const rsDivisor = (degree: number) => {
    const result = new Array<number>(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = gfMultiply(result[j], root);
            if (j + 1 < degree) result[j] ^= result[j + 1];
        }
        root = gfMultiply(root, 0x02);
    }
    return result;
};

/** The Reed-Solomon error correction codewords of `data`. */
export const rsRemainder = (data: number[], degree: number) => {
    const divisor = rsDivisor(degree);
    const result = new Array<number>(degree).fill(0);
    for (const b of data) {
        const factor = b ^ (result.shift() ?? 0);
        result.push(0);
        for (let i = 0; i < degree; i++) result[i] ^= gfMultiply(divisor[i], factor);
    }
    return result;
};

const rawDataModules = (ver: number) => {
    let result = ((16 * ver) + 128) * ver + 64;
    if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= ((25 * numAlign) - 10) * numAlign - 55;
        if (ver >= 7) result -= 36;
    }
    return result;
};

const dataCodewords = (ver: number) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ver - 1] * BLOCKS[ver - 1];

const alignmentPositions = (ver: number, size: number) => {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [ 6 ];
    let pos = size - 7;
    while (result.length < numAlign) {
        result.splice(1, 0, pos);
        pos -= step;
    }
    return result;
};

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

/** The data codewords of `bytes` in byte mode, with terminator and padding, for `ver`. */
const encodeData = (bytes: Uint8Array, ver: number) => {
    const bits: number[] = [];
    const put = (value: number, length: number) => {
        for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
    };
    put(0b0100, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    for (const b of bytes) put(b, 8);
    const capacity = dataCodewords(ver) * 8;
    put(0, Math.min(4, capacity - bits.length));
    put(0, (8 - (bits.length % 8)) % 8);
    const result: number[] = [];
    for (let i = 0; i < bits.length; i += 8) result.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
    let pad = 0xEC;
    while (result.length < dataCodewords(ver)) {
        result.push(pad);
        pad ^= 0xEC ^ 0x11;
    }
    return result;
};

/** Data and error correction codewords, split in blocks and interleaved. */
const withErrorCorrection = (data: number[], ver: number) => {
    const numBlocks = BLOCKS[ver - 1];
    const eccLen = ECC_PER_BLOCK[ver - 1];
    const raw = Math.floor(rawDataModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const blocks: number[][] = [];
    let k = 0;
    for (let i = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
        k += dat.length;
        const ecc = rsRemainder(dat, eccLen);
        if (i < numShort) dat.push(0);
        blocks.push(dat.concat(ecc));
    }
    const result: number[] = [];
    for (let i = 0; i < blocks[0].length; i++) {
        for (let j = 0; j < blocks.length; j++) {
            if (i !== shortLen - eccLen || j >= numShort) result.push(blocks[j][i]);
        }
    }
    return result;
};

const MASKS: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    x => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
];

/* ---------- Penalty of a masked matrix (rules N1 to N4) ---------- */

/** N1: runs of five or more modules of one color in a line. */
const runPenalty = (line: boolean[]) => {
    let score = 0;
    let run = 1;
    for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === line[i - 1]) {
            run++;
            continue;
        }
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
    }
    return score;
};

const FINDER_LIKE = [ true, false, true, true, true, false, true ];
const matchesAt = (line: boolean[], at: number, pattern: boolean[]) => pattern.every((p, i) => line[at + i] === p);
const lightAt = (line: boolean[], from: number, count: number) => line.slice(from, from + count).every(dark => !dark);

/** N3: a finder-like pattern with four light modules on one side. */
const finderPenalty = (line: boolean[]) => {
    let score = 0;
    for (let i = 0; i + 10 < line.length; i++) {
        if ((matchesAt(line, i + 4, FINDER_LIKE) && lightAt(line, i, 4)) || (matchesAt(line, i, FINDER_LIKE) && lightAt(line, i + 7, 4))) score += 40;
    }
    return score;
};

/** N2: 2x2 blocks of one color. */
const boxPenalty = (m: boolean[][]) => {
    let score = 0;
    for (let y = 0; y + 1 < m.length; y++) {
        for (let x = 0; x + 1 < m.length; x++) {
            const c = m[y][x];
            if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
        }
    }
    return score;
};

/** N4: how far the dark modules are from half. */
const balancePenalty = (m: boolean[][]) => {
    const total = m.length * m.length;
    const dark = m.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
    return Math.floor(Math.abs((dark * 20) - (total * 10)) / total) * 10;
};

const penalty = (m: boolean[][]) => {
    const columns = m.map((_, x) => m.map(row => row[x]));
    const lines = [ ...m, ...columns ];
    return lines.reduce((sum, line) => sum + runPenalty(line) + finderPenalty(line), 0) + boxPenalty(m) + balancePenalty(m);
};

/* ---------- The matrix ---------- */

class QrMatrix {
    readonly size: number;
    readonly modules: boolean[][];
    readonly isFunction: boolean[][];

    constructor(readonly ver: number) {
        this.size = ver * 4 + 17;
        this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
        this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    }

    set(x: number, y: number, dark: boolean) {
        this.modules[y][x] = dark;
        this.isFunction[y][x] = true;
    }

    /** Timing, finder and alignment patterns, the format (reserved) and the version information. */
    drawFunctionPatterns() {
        const { size } = this;
        for (let i = 0; i < size; i++) {
            this.set(6, i, i % 2 === 0);
            this.set(i, 6, i % 2 === 0);
        }
        for (const [ cx, cy ] of [ [ 3, 3 ], [ size - 4, 3 ], [ 3, size - 4 ] ]) this.drawFinder(cx, cy);
        const align = alignmentPositions(this.ver, size);
        const last = align.length - 1;
        for (let i = 0; i <= last; i++) {
            for (let j = 0; j <= last; j++) {
                const corner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
                if (!corner) this.drawAlignment(align[j], align[i]);
            }
        }
        this.drawFormat(0);
        this.drawVersion();
    }

    drawFinder(cx: number, cy: number) {
        for (let dy = -4; dy <= 4; dy++) {
            for (let dx = -4; dx <= 4; dx++) {
                const x = cx + dx;
                const y = cy + dy;
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.set(x, y, dist !== 2 && dist !== 4);
            }
        }
    }

    drawAlignment(cx: number, cy: number) {
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) this.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
    }

    drawFormat(mask: number) {
        const { size } = this;
        const data = (FORMAT_LEVEL_M << 3) | mask;
        let rem = data;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const bits = ((data << 10) | rem) ^ 0x5412;
        for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
        this.set(8, 7, bit(bits, 6));
        this.set(8, 8, bit(bits, 7));
        this.set(7, 8, bit(bits, 8));
        for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
        for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(bits, i));
        for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(bits, i));
        this.set(8, size - 8, true);
    }

    drawVersion() {
        if (this.ver < 7) return;
        let rem = this.ver;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        const bits = (this.ver << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const a = this.size - 11 + (i % 3);
            const b = Math.floor(i / 3);
            this.set(a, b, bit(bits, i));
            this.set(b, a, bit(bits, i));
        }
    }

    /** The columns of two modules the data goes up and down, from the right (the timing column is skipped). */
    dataColumns() {
        const result: number[] = [];
        for (let right = this.size - 1; right >= 1; right -= 2) result.push(right <= 6 ? right - 1 : right);
        return result;
    }

    /** The codewords in zigzag, from the bottom right corner. */
    drawCodewords(codewords: number[]) {
        const { size } = this;
        let i = 0;
        for (const right of this.dataColumns()) {
            const upward = ((right + 1) & 2) === 0;
            for (let vert = 0; vert < size; vert++) {
                const y = upward ? size - 1 - vert : vert;
                for (const x of [ right, right - 1 ]) {
                    if (!this.isFunction[y][x] && i < codewords.length * 8) {
                        this.modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
                        i++;
                    }
                }
            }
        }
    }

    /** The modules with `mask` applied to the data (and its format information). */
    masked(mask: number) {
        this.drawFormat(mask);
        return this.modules.map((row, y) => row.map((dark, x) => (this.isFunction[y][x] ? dark : dark !== MASKS[mask](x, y))));
    }
}

const versionFor = (length: number) => {
    for (let ver = 1; ver <= MAX_VERSION; ver++) {
        if (4 + (ver <= 9 ? 8 : 16) + length * 8 <= dataCodewords(ver) * 8) return ver;
    }
    throw new Error('Text too long for a QR code');
};

/**
 * The modules of the QR code of `text` (true: dark), without the quiet zone. Throws when it does not fit in version
 * 10 at level M.
 */
export const encodeQr = (text: string): boolean[][] => {
    const bytes = new TextEncoder().encode(text);
    const ver = versionFor(bytes.length);
    const matrix = new QrMatrix(ver);
    matrix.drawFunctionPatterns();
    matrix.drawCodewords(withErrorCorrection(encodeData(bytes, ver), ver));
    let best = matrix.masked(0);
    let bestScore = penalty(best);
    for (let mask = 1; mask < MASKS.length; mask++) {
        const candidate = matrix.masked(mask);
        const score = penalty(candidate);
        if (score < bestScore) {
            best = candidate;
            bestScore = score;
        }
    }
    return best;
};

/** An SVG path of the dark modules (one unit each), offset by `margin` (the quiet zone). */
export const qrPath = (modules: boolean[][], margin = 4) => modules
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + margin} ${y + margin}h1v1h-1z` : '')))
    .join('');
