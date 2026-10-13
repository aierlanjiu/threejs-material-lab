import {INSTRUMENTS} from './instrument-manifest.js';
import {petFrameAt} from '../audio/band-stage-layout.js';

export const BAND_PETS=Object.freeze(INSTRUMENTS.map(role=>Object.freeze({
 id:role.id,asset:new URL(`../../assets/band-pets/${role.id}.webp`,import.meta.url).href,
 frameCount:4,frameWidth:256,frameHeight:320,baseline:.94,family:role.family
})));
const byId=new Map(BAND_PETS.map(p=>[p.id,p]));
export const bandPet=id=>{const pet=byId.get(id);if(!pet)throw new Error(`Unknown band pet: ${id}`);return pet;};
export {petFrameAt};
