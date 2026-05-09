const poles = 8;
const slots = 12;
const cx = 935, cy = 935;
const outerR = 425, innerR = 220, slotR = 357;
const slotH = 88;

const angleStep = (2 * Math.PI) / slots;
const startAngle = -Math.PI / 2;

function slotAngle(slotNum) {
    return startAngle + (slotNum - 1) * angleStep;
}

const slotTop = [];
const slotBottom = [];

for (let i = 1; i <= slots; i++) {
    const ang = slotAngle(i);
    const topR = slotR + slotH * 0.5;
    const botR = innerR;
    slotTop[i] = { x: cx + topR * Math.cos(ang), y: cy + topR * Math.sin(ang), ang: ang };
    slotBottom[i] = { x: cx + botR * Math.cos(ang), y: cy + botR * Math.sin(ang), ang: ang };
}

console.log("--- Math Test ---");
console.log("slotAngle(1) (radians):", slotAngle(1));
console.log("slotAngle(1) (degrees):", slotAngle(1) * 180 / Math.PI);
console.log(`slotTop[1] -> x: ${slotTop[1].x.toFixed(2)}, y: ${slotTop[1].y.toFixed(2)}`);
console.log(`slotBottom[1] -> x: ${slotBottom[1].x.toFixed(2)}, y: ${slotBottom[1].y.toFixed(2)}`);

const q = slots / (3 * poles);
const isConcentrated = (q < 1);
console.log(`isConcentrated: ${isConcentrated} (q=${q})`);
