/**
 * Browser Buffer shim.
 *
 * The deploy/verify path pulls in Node-targeted packages
 * (@subsquid/scale-codec, @subsquid/util-internal-hex,
 * @midnight-ntwrk/wallet-sdk-address-format) that reference the Node global
 * `Buffer`. This exposes the already-installed `buffer` browser package
 * (a transitive dependency of @midnight-ntwrk/midnight-js-utils) as that
 * global, so the same Buffer API is available in the browser.
 */
import { Buffer } from 'buffer';

(globalThis as { Buffer?: unknown }).Buffer = Buffer;