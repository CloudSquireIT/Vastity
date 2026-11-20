// Icona Vastity: galassia a spirale procedurale su cielo blu notte. Coordinate: altezza = 2.
#define DEBUG_MODE 0
const float TILT = P_TILT;      // 1 = vista di fronte, 0.25 = quasi di taglio
const float ROT = P_ROT;        // rotazione sullo schermo (radianti)
const float ARMS = P_ARMS;      // numero di bracci
const float PITCH = P_PITCH;    // avvolgimento: più alto = bracci più chiusi
const float SHARP = P_SHARP;    // nitidezza dei bracci
const float WARP = P_WARP;      // irregolarità dei bracci
const float BAR = P_BAR;        // lunghezza della barra centrale (0 = nessuna)
const float SIZE = P_SIZE;      // raggio della galassia
const float DUST = P_DUST;      // polvere scura lungo i bracci
const float KNOTS = P_KNOTS;    // ammassi stellari blu nei bracci
const float CORE_K = P_COREK;   // luminosità del nucleo
const vec3 CORE = P_CORE;       // colore del nucleo (sRGB)
const vec3 ARMC = P_ARMC;       // colore dei bracci (sRGB)
const float EXPOSURE = P_EXP;
const float SPIN = P_SPIN;      // verso della spirale (1 o -1)

float bigStar(vec2 uv, vec2 c, float r, float px) {
    vec2 d = uv - c; float l = length(d);
    float core = 1.0 - smoothstep(r * 0.25, r * 0.25 + px, l);
    float glow = exp(-l * l / (r * r * 0.08)) * 0.8;
    float spikes = exp(-abs(d.x) / (px * 0.9)) * exp(-abs(d.y) / r) + exp(-abs(d.y) / (px * 0.9)) * exp(-abs(d.x) / r);
    return core + glow + 0.9 * spikes;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    float px = 2.0 / iResolution.y;
    vec2 sv = fragCoord / iResolution.xy;

    // piano della galassia
    vec2 q = rot2(ROT) * uv;
    vec2 p = vec2(q.x, q.y / TILT) / SIZE;
    float r = length(p);
    float th = atan(p.y, p.x + 1e-6) * SPIN;
    float w = WARP * fbm(p * 2.6 + 3.1, 4);
    float rArm = max(r, BAR * 0.9 + 0.04);
    float ph = th - log(rArm) * PITCH + w;
    float arm = pow(0.5 + 0.5 * cos(ARMS * ph), SHARP);
    float armIn = smoothstep(BAR * 0.7 + 0.02, BAR * 0.9 + 0.15, r);
    float disk = exp(-r / 0.34) * (1.0 - smoothstep(0.7, 1.15, r));
    float clump = 0.75 + 0.4 * fbm(p * 7.0 + 7.0, 4);
    float armD = disk * (0.10 + 2.2 * arm * armIn) * clump;
    float lane = pow(0.5 + 0.5 * cos(ARMS * ph - 0.55), SHARP * 2.0) * armIn * disk;
    float bulge = 1.5 * exp(-pow(r / 0.055, 0.9)) + 0.45 * exp(-r / 0.12);
    float bar = BAR > 0.0 ? 1.1 * exp(-pow(p.x / BAR, 2.0) * 2.2 - pow(p.y / (BAR * 0.22), 2.0)) : 0.0;

    // ammassi stellari giovani (blu) lungo i bracci
    vec2 g = p * 34.0; vec2 id = floor(g); vec3 h = hash32(id + 13.0);
    vec2 kc = id + 0.2 + 0.6 * h.xy;
    float knot = step(0.7, h.z) * exp(-dot(g - kc, g - kc) * 60.0) * arm * armIn * disk * 5.0 * KNOTS;

    vec3 coreC = srgbToLinear(CORE), armC = srgbToLinear(ARMC);
    vec3 col = coreC * (bulge + bar) * CORE_K + armC * armD * 1.4 + vec3(0.75, 0.88, 1.0) * knot;
    col *= 1.0 - DUST * clamp(lane * 2.2, 0.0, 0.85);
    col *= 1.0;
#if DEBUG_MODE == 5
    col = vec3(arm * armIn, lane, disk);
#endif
    vec3 outc = linearToSrgb(tonemapAgX(EXPOSURE * col));

    // cielo blu notte e stelle ben visibili anche a dimensione icona
    vec3 sky = mix(vec3(0.010, 0.016, 0.055), vec3(0.060, 0.100, 0.270), sv.y * sv.y);
    float gal = clamp(dot(outc, vec3(0.33)), 0.0, 1.0);
    float st = 0.0;
    for (int k = 0; k < 2; ++k) {
        float cells = k == 0 ? 16.0 : 38.0;
        vec2 sq = uv * cells; vec2 sid = floor(sq); vec3 sh = hash32(sid + float(k) * 57.0 + P_SEED);
        vec2 c = (sid + 0.2 + 0.6 * sh.xy) / cells;
        float rad = (k == 0 ? 3.4 : 2.0) * px * (0.7 + 0.6 * sh.z);
        float on = step(k == 0 ? 0.72 : 0.86, sh.z);
        st += on * (0.45 + 0.55 * sh.y) * (1.0 - smoothstep(rad * 0.5, rad, length(uv - c)));
    }
    // poche stelle grandi con raggi, riconoscibili anche sull'iPhone
    for (int i = 0; i < 7; ++i) {
        vec3 hs = hash32(vec2(float(i) * 3.7 + P_SEED, 11.0));
        vec2 c = (hs.xy * 2.0 - 1.0) * vec2(0.92, 0.92);
        if (length(rot2(ROT) * c / vec2(SIZE, SIZE * TILT)) < 0.75) c = -c * 1.05;
        st += bigStar(uv, c, (0.035 + 0.04 * hs.z), px) * 0.9;
    }
    outc = outc + sky * (1.0 - gal) + vec3(0.92, 0.95, 1.0) * st * (1.0 - 0.8 * gal);
    fragColor = vec4(outc + ditherTPDF(fragCoord, iFrame), 1.0);
}
