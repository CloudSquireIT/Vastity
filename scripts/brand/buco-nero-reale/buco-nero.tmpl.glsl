// Null-ray orbits around a Schwarzschild black hole. Lengths in Schwarzschild radii.
// @render time=4.0
// @variant DEBUG_MODE=3
#define DISK_PASS 0 // 0 single pass, 1 bake camera transfer, 2 shade the retained transfer texture
#define DEBUG_MODE 0 // 3 direct disk (copper), higher-order disk (blue), capture (black)
const float INCLINATION = V_INC;  // camera elevation above disk in radians
const float CAMERA_RADIUS = 30.0;
const float ANGLE_STEP = 0.048;
const float EXPOSURE = V_EXP;
const float ZOOM = V_ZOOM;      // focale: più alta = buco nero più grande
const float BEAMING = V_BEAM;   // asimmetria di luce: il lato che viene verso di noi è più brillante
const vec3 HOT = V_HOT;          // colore del gas più caldo (sRGB)
const float STREAK = V_STREAK;   // intensità delle venature
const float R_IN = 2.25;         // bordo interno del disco
const float R_OUT = V_ROUT;      // estensione del disco
const float FALL = V_FALL;       // quanto rapidamente il disco si spegne verso l'esterno

vec3 diskLight(vec3 p, float shift) {
    float r = length(p);
    float az = atan(p.z, p.x);
    float phi = az - iTime * 0.85 / pow(r / 3.0, 1.5);
    vec2 orbit = vec2(cos(phi), sin(phi));
    float turbulent = fbm(vec2(r * 3.0, dot(orbit, vec2(2.0, 1.3))) + 0.22 * orbit, 3);
    // venature sottili e appena accennate
    float streaks = 1.0 + STREAK * sin(38.0 * r + 5.0 * turbulent);
    // bordo interno netto (orbita stabile più interna), coda esterna lunga e morbida
    float radial = smoothstep(R_IN - 0.35, R_IN + 0.15, r) * (1.0 - smoothstep(R_OUT * 0.45, R_OUT, r));
    float emiss = pow(R_IN / r, FALL) * radial * streaks * (1.0 + 0.12 * turbulent);
    float t = clamp(pow(R_IN / r, 0.9) * shift, 0.0, 1.4);
    vec3 cOut = srgbToLinear(vec3(0.30, 0.45, 1.0));
    vec3 cMid = srgbToLinear(vec3(0.66, 0.78, 1.0));
    vec3 cHot = srgbToLinear(HOT);
    vec3 tint = mix(cOut, cMid, smoothstep(0.35, 0.7, t));
    tint = mix(tint, cHot, smoothstep(0.75, 1.15, t));
    return tint * emiss * pow(shift, BEAMING) * 2.2;
}

vec3 distantStars(vec3 dir) {
    vec2 uv = vec2(atan(dir.z, dir.x), asin(clamp(dir.y, -1.0, 1.0)));
    vec2 q = uv * 115.0;
    vec2 id = floor(q);
    vec3 h = hash32(id);
    float star = exp(-65.0 * dot2(fract(q) - mix(vec2(0.12), vec2(0.88), h.xy))) * step(0.965, h.z) * (0.5 + 0.8 * h.y);
    float dust = 0.5 + 0.5 * fbm(dir * 4.0, 4, 2.01, 0.5);
    return vec3(0.006, 0.010, 0.030) * dust * dust
         + mix(vec3(0.65, 0.77, 1.0), vec3(1.0, 0.71, 0.40), h.x) * star * 0.0;
}

vec4 diskTransfer(vec2 fragCoord) {
    vec2 uv = rot2(-0.208) * ((2.0 * fragCoord - iResolution.xy) / iResolution.y);
    vec3 radial = vec3(0.0, sin(INCLINATION), cos(INCLINATION));
    vec3 ro = CAMERA_RADIUS * radial;
    vec3 rd = cameraRay(cameraMatrix(ro, vec3(0), 0.0), uv, ZOOM);
    vec3 side = rd - dot(rd, radial) * radial;
    float sine = length(side);
    side /= max(sine, 1e-8);
    float u0 = 1.0 / CAMERA_RADIUS;
    vec2 orbit = vec2(u0, -dot(rd, radial) * u0 * sqrt(1.0 - u0) / max(sine, 1e-8));
    // Intersections with the disk plane repeat every pi radians in the ray plane.
    float crossing = atan(-radial.y, side.y);
    crossing = mod(crossing, PI);
    for (int i = 0; i < 220; ++i) {
        float phi = float(i) * ANGLE_STEP;
        vec2 next = nullOrbitStep(orbit, ANGLE_STEP);
        if (phi + ANGLE_STEP >= crossing) {
            vec2 atDisk = nullOrbitStep(orbit, clamp(crossing - phi, 0.0, ANGLE_STEP));
            if (atDisk.x > 1.0 / R_OUT && atDisk.x < 1.0 / (R_IN - 0.4)) {
                vec3 er = cos(crossing) * radial + sin(crossing) * side;
                vec3 ep = -sin(crossing) * radial + cos(crossing) * side;
                vec3 view = normalize(atDisk.y * er - atDisk.x * sqrt(1.0 - atDisk.x) * ep);
                vec3 p = er / atDisk.x;
                float r = length(p);
                float speed = inversesqrt(2.0 * max(r - 1.0, 1.2));
                vec3 tangent = vec3(-p.z, 0.0, p.x) / r;
                float shift = sqrt((1.0 - 1.0 / r) * (1.0 - speed * speed))
                            / (1.0 - speed * dot(tangent, view));
                return vec4(p.xz,shift,crossing < PI ? 2.0 : 3.0);
            }
            crossing += PI;
        }
        if (next.x >= 1.0 || sine < 1e-7) break;
        if (next.x <= 0.0) {
            float escape = phi + ANGLE_STEP * orbit.x / (orbit.x - next.x);
            return vec4(cos(escape) * radial + sin(escape) * side, 1.0);
        }
        orbit = next;
    }
    return vec4(0.0);
}

float bigStar(vec2 uv, vec2 c, float r, float px) {
    vec2 d = uv - c; float l = length(d);
    float core = 1.0 - smoothstep(r * 0.22, r * 0.22 + 2.0 * px, l);
    float glow = exp(-l * l / (r * r * 0.10)) * 1.1 + exp(-l / (r * 0.9)) * 0.25;
    float spikes = exp(-abs(d.x) / (2.2 * px)) * exp(-abs(d.y) / (r * 0.45)) + exp(-abs(d.y) / (2.2 * px)) * exp(-abs(d.x) / (r * 0.45));
    return core + glow + 0.45 * spikes;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
#if DISK_PASS == 2
    vec4 transfer = texelFetch(iChannel0, ivec2(fragCoord), 0);
#else
    vec4 transfer = diskTransfer(fragCoord);
#endif
#if DISK_PASS == 1
    fragColor = transfer;
    return;
#endif
    vec2 sv = fragCoord / iResolution.xy;
    // cielo blu notte in spazio display (non passa dal tonemap)
    // tramonto: blu in alto, viola al centro, arancione in basso
    float ty = sv.y;
    vec3 sky = mix(vec3(0.93, 0.47, 0.22), vec3(0.42, 0.16, 0.48), smoothstep(0.0, 0.45, ty));
    sky = mix(sky, vec3(0.16, 0.10, 0.42), smoothstep(0.35, 0.72, ty));
    sky = mix(sky, vec3(0.04, 0.07, 0.26), smoothstep(0.65, 1.0, ty));
    if (iFrame == 1) sky = vec3(0.0); // passata per il bagliore: solo disco e stelle
    bool escaped = false;
    vec3 col = vec3(0.0);
    if (transfer.w > 1.5) {
        col = diskLight(vec3(transfer.x,0.0,transfer.y),transfer.z);
#if DEBUG_MODE == 3
        col = transfer.w < 2.5 ? vec3(0.8,0.28,0.08) : vec3(0.1,0.55,1.0);
#endif
    } else if (transfer.w > 0.5) {
        col = distantStars(transfer.xyz);
        escaped = true;
    }
    vec3 outc = linearToSrgb(tonemapAgX(EXPOSURE * col));
    // il gas è luminoso e semitrasparente: si somma al cielo (fusione "screen"), niente contorni
    if (transfer.w > 1.5) outc = 1.0 - (1.0 - sky) * (1.0 - outc);
    if (escaped) {
        // poche stelle grandi e molto luminose, posizionate lontano dal disco
        float px = 2.0 / iResolution.y;
        vec2 suv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
        float stars = 0.0;
        stars += bigStar(suv, vec2(-0.66, 0.70), 0.110, px);
        stars += bigStar(suv, vec2(0.60, 0.80), 0.075, px);
        stars += bigStar(suv, vec2(0.80, -0.58), 0.095, px);
        stars += bigStar(suv, vec2(-0.50, -0.78), 0.070, px);
        stars += bigStar(suv, vec2(0.08, -0.90), 0.050, px);
        stars += bigStar(suv, vec2(-0.88, 0.22), 0.050, px);
        outc = sky + outc + vec3(0.93, 0.96, 1.0) * stars;
    }
    fragColor = vec4(outc + ditherTPDF(fragCoord, iFrame), 1.0);
}
