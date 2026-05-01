const poles = 42;
const slots = 36;
const slotMap = {};
const phaseSlots = { U: [], V: [], W: [] };

const q = slots / (3 * poles);
const isConcentrated = (q < 1);

const p = poles / 2;
const alphaSlot = p * 360 / slots;
const isDegenerate = Math.abs(alphaSlot % 60) < 0.01 || Math.abs(alphaSlot % 60 - 60) < 0.01;

for (let t = 1; t <= slots; t++) {
  const thetaRaw = (t - 1) * p * (360 / slots);
  const thetaMod = ((thetaRaw % 360) + 360) % 360;
  
  let phase = '', dir = '';
  
  if (isDegenerate) {
    const phaseSeq = ['U', 'W', 'V'];
    const phaseIdx = Math.round(thetaMod / (360 / 3)) % 3;
    phase = phaseSeq[phaseIdx];
    const poleNum = Math.floor(thetaRaw / 180);
    dir = (poleNum % 2 === 0) ? 'go' : 'return';
  } else {
    let zone = Math.floor((thetaMod + 1e-6) / 60) % 6;
    if (zone === 0) { phase = 'U'; dir = 'go'; }
    else if (zone === 1) { phase = 'W'; dir = 'return'; }
    else if (zone === 2) { phase = 'V'; dir = 'go'; }
    else if (zone === 3) { phase = 'U'; dir = 'return'; }
    else if (zone === 4) { phase = 'W'; dir = 'go'; }
    else if (zone === 5) { phase = 'V'; dir = 'return'; }
  }
  
  const s1 = t;
  const s2 = (t % slots) + 1;
  
  if (!slotMap[s1]) slotMap[s1] = phase;
  if (!slotMap[s2]) slotMap[s2] = phase;
  
  if (dir === 'go') { phaseSlots[phase].push([s1, s2]); }
  else { phaseSlots[phase].push([s2, s1]); }
}

const windingDir = {};
['U', 'V', 'W'].forEach(phase => {
  phaseSlots[phase].forEach(pair => {
    windingDir[pair[0]] = 'go';
    windingDir[pair[1]] = 'return';
  });
});

for (let i = 1; i <= 9; i++) {
  console.log(`Slot ${i}: map=${slotMap[i]}, dir=${windingDir[i]}`);
}
