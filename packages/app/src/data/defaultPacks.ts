import core from '../../../../packs/core-3.5e.json';
import memento from '../../../../packs/memento.json';
import { PackSchema, type Pack } from '@hl/engine';

export const defaultPacks: Pack[] = [core, memento].map((p) => PackSchema.parse(p));
