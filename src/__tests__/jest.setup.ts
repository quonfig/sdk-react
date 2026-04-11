import * as crypto from "crypto";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore -- We don't expect this to be compatible we just need it for the uuid library
if (!global.crypto) global.crypto = crypto;
