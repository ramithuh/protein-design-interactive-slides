"""The 20 amino acids as 2D structure drawings, for the alphabet slide.

    python tools/prep_amino_acids.py talks/example/data/amino_acids.json --structure talks/example/data/1ubq.cif --start 1
    python tools/prep_amino_acids.py out.json --peptide MQIFVKT        # the drawings only, no 3D

Every drawing puts the shared backbone (H2N-CH-COOH) in the same place at the same scale, with the side chain
turned to hang straight below the Cα, so the 20 differ only in their side chains. Drawn in placeholder colours
that the slide swaps for its theme's (SENTINEL; side-chain bonds in SIDE). Also writes a generic amino acid
with its side chain as "R". With --peptide (a sequence, no letter twice), also draws those amino acids
laid out along a zigzag chain, side chains alternating up and down, each in the same shape as its alphabet
drawing (mirrored when it points up), once as separate amino acids and once joined into the peptide, all on
one canvas so they overlay. With --structure (and --start, --length), the peptide is that stretch of the
file's first protein chain, and its real 3D coordinates are written too ("segment": every heavy atom, which
are backbone, the bonds), for the geometry slide that lifts the drawing into 3D.
Writes <out>.json and <out>.js (window.DATA["<out stem>"]).
Needs RDKit, gemmi and numpy.
"""

import argparse
import json
import math
import re
from pathlib import Path

import gemmi
import numpy as np

from rdkit import Chem
from rdkit.Chem import rdDepictor
from rdkit.Chem.Draw import rdMolDraw2D
from rdkit.Geometry import Point2D

FONT = Path(__file__).resolve().parent.parent / "vendor" / "fonts" / "Lato-Semibold.ttf"
# bonds and carbon, N, O, S; side-chain bonds get SIDE (the slide gives them the amino acid's class colour)
SENTINEL = {"C": "#010101", "N": "#020202", "O": "#030303", "S": "#040404"}
SIDE = "#0a0a0a"
CLASS_SIDE = {"hydrophobic": "#0a0a0a", "polar": "#0b0b0b", "positive": "#0c0c0c", "negative": "#0d0d0d",
              "special": "#0e0e0e"}
AMINO = [  # one-letter, three-letter, name, class, SMILES (neutral, no stereo: L-forms throughout)
    # classes and order as in Wikipedia's amino-acid chart (selenocysteine, its 21st, left out)
    ("R", "Arg", "arginine", "positive", "NC(CCCNC(N)=N)C(=O)O"),
    ("H", "His", "histidine", "positive", "NC(Cc1cnc[nH]1)C(=O)O"),
    ("K", "Lys", "lysine", "positive", "NC(CCCCN)C(=O)O"),
    ("D", "Asp", "aspartate", "negative", "NC(CC(=O)O)C(=O)O"),
    ("E", "Glu", "glutamate", "negative", "NC(CCC(=O)O)C(=O)O"),
    ("S", "Ser", "serine", "polar", "NC(CO)C(=O)O"),
    ("T", "Thr", "threonine", "polar", "NC(C(C)O)C(=O)O"),
    ("N", "Asn", "asparagine", "polar", "NC(CC(N)=O)C(=O)O"),
    ("Q", "Gln", "glutamine", "polar", "NC(CCC(N)=O)C(=O)O"),
    ("C", "Cys", "cysteine", "special", "NC(CS)C(=O)O"),
    ("G", "Gly", "glycine", "special", "NCC(=O)O"),
    ("P", "Pro", "proline", "special", "N1CCCC1C(=O)O"),
    ("A", "Ala", "alanine", "hydrophobic", "NC(C)C(=O)O"),
    ("V", "Val", "valine", "hydrophobic", "NC(C(C)C)C(=O)O"),
    ("I", "Ile", "isoleucine", "hydrophobic", "NC(C(C)CC)C(=O)O"),
    ("L", "Leu", "leucine", "hydrophobic", "NC(CC(C)C)C(=O)O"),
    ("M", "Met", "methionine", "hydrophobic", "NC(CCSC)C(=O)O"),
    ("F", "Phe", "phenylalanine", "hydrophobic", "NC(Cc1ccccc1)C(=O)O"),
    ("Y", "Tyr", "tyrosine", "hydrophobic", "NC(Cc1ccc(O)cc1)C(=O)O"),
    ("W", "Trp", "tryptophan", "hydrophobic", "NC(Cc1c[nH]c2ccccc12)C(=O)O"),
]
# The backbone, laid out once: N up-left of the Cα, the carboxyl up-right, the side chain straight down.
BACKBONE = Chem.MolFromSmarts("[NX3]-[CX4]-C(=O)-[OX2]")
LAYOUT = [(-1.299, 0.75), (0.0, 0.0), (1.299, 0.75), (1.299, 2.25), (2.598, 0.0)]
PX = 30          # pixels per unit (RDKit's 2D bonds are 1.5 units)
MARGIN = 0.75    # units around the atoms, for labels like NH2


def hex_rgb(h):
    return tuple(int(h[k:k + 2], 16) / 255 for k in (1, 3, 5))


def template():
    t = Chem.MolFromSmiles("NCC(=O)O")
    conf = Chem.Conformer(t.GetNumAtoms())
    for i, (x, y) in enumerate(LAYOUT):
        conf.SetAtomPosition(i, (x, y, 0.0))
    t.AddConformer(conf, assignId=True)
    return t


def hang(mol):
    """Turn the side chain about the Cα so its farthest atom is straight below (proline's ring stays put)."""
    if mol.GetNumAtoms() <= 5 or mol.GetAtomWithIdx(0).GetDegree() > 1:
        return
    conf = mol.GetConformer()
    ca = conf.GetAtomPosition(1)
    side = range(5, mol.GetNumAtoms())
    far = max(side, key=lambda i: (conf.GetAtomPosition(i) - ca).Length())
    v = conf.GetAtomPosition(far) - ca
    turn = -math.pi / 2 - math.atan2(v.y, v.x)
    c, s = math.cos(turn), math.sin(turn)
    for i in side:
        p = conf.GetAtomPosition(i) - ca
        conf.SetAtomPosition(i, (ca.x + c * p.x - s * p.y, ca.y + s * p.x + c * p.y, 0.0))


def extent(mol):
    pos = mol.GetConformer().GetPositions()
    return pos[:, 0].min(), pos[:, 1].min(), pos[:, 0].max(), pos[:, 1].max()


def draw(mol, side, window):
    """SVG of mol in the shared window, its side-chain bonds in placeholder colours (side: atom index -> colour,
    or a list of atom indices for SIDE)."""
    if not isinstance(side, dict):
        side = {i: SIDE for i in side}
    w, h = round((window[2] - window[0]) * PX), round((window[3] - window[1]) * PX)
    d = rdMolDraw2D.MolDraw2DSVG(w, h)
    o = d.drawOptions()
    o.clearBackground = False
    o.fontFile = str(FONT)
    o.bondLineWidth = 2
    o.centreMoleculesBeforeDrawing = False
    o.padding = 0.0
    o.fixedBondLength = PX * 1.5  # RDKit's 2D bond length is 1.5 units
    o.updateAtomPalette({Chem.GetPeriodicTable().GetAtomicNumber(el): hex_rgb(c) for el, c in SENTINEL.items()})
    o.setSymbolColour(hex_rgb(SENTINEL["C"]))
    d.SetScale(w, h, Point2D(window[0], window[1]), Point2D(window[2], window[3]))
    d.DrawMolecule(mol)
    d.FinishDrawing()
    svg = d.GetDrawingText()
    svg = svg[svg.index("<svg"):]
    # recolour the carbon-coloured strokes of side-chain bonds (each bond path is classed bond-<index>)
    bonds = {b.GetIdx(): side.get(b.GetEndAtomIdx(), side.get(b.GetBeginAtomIdx())) for b in mol.GetBonds()
             if b.GetBeginAtomIdx() in side or b.GetEndAtomIdx() in side}
    svg = re.sub(r"<path class='bond-(\d+) [^>]*>",
                 lambda m: m.group(0).replace(SENTINEL["C"], bonds[int(m.group(1))]) if int(m.group(1)) in bonds
                 else m.group(0), svg)
    ca = d.GetDrawCoords(1)
    # how far down the drawing reaches (pixels), so a row of drawings can be cut to its deepest member
    bottom = max(d.GetDrawCoords(i).y for i in range(mol.GetNumAtoms())) + 0.6 * PX
    atoms = [[round(d.GetDrawCoords(i).x, 1), round(d.GetDrawCoords(i).y, 1)] for i in range(mol.GetNumAtoms())]
    return svg, [round(ca.x, 1), round(ca.y, 1)], [w, h], round(bottom, 1), atoms


STEP = 1.299  # x step between backbone atoms on the zigzag (1.5-unit bonds at 120°)


# RDKit's peptide builder names isoleucine's γ-carbons the other way round from the PDB, where CD1 hangs off CG1
# (the ethyl arm) and CG2 is the methyl. The drawing uses RDKit's names throughout, which is consistent; only the
# names written out for a 3D model to match against (PDB names) are translated.
RDKIT_TO_PDB = {"I": {"CG1": "CG2", "CG2": "CG1"}}


def pdb_name(one, name):
    return RDKIT_TO_PDB.get(one, {}).get(name, name)


def check_pairing(segment, peptide):
    """Every bond of the 3D stretch should be one bond long in the drawing too: a name paired with the wrong atom
    shows up as a bond that starts stretched across the drawing."""
    atoms, flat = segment["atoms"], peptide["atoms"]
    where = [flat[f"{a['res']} {a['name']}"] for a in atoms]
    lengths = [math.dist(where[i], where[j]) for i, j, *_ in segment["bonds"]]
    typical = sorted(lengths)[len(lengths) // 2]
    bad = [f"{atoms[i]['res']} {atoms[i]['name']}-{atoms[j]['name']} ({math.dist(where[i], where[j]) / typical:.1f}x)"
           for i, j, *_ in segment["bonds"] if math.dist(where[i], where[j]) > 1.3 * typical]
    assert not bad, f"atoms paired wrongly between the drawing and the 3D stretch: {bad}"
    print(f"pairing checked: all {len(lengths)} bonds are one bond long in the drawing")


def peptide(segment, depictions):
    """The stretch's amino acids on a zigzag chain: free ones (each with its own OH and H2N) and the joined
    peptide, all in the same coordinates. depictions: one-letter code -> its alphabet drawing's molecule."""
    seq = "".join(r["one"] for r in segment["residues"])
    rel = {}  # one-letter -> PDB atom name -> position relative to the Cα, side chain hanging down
    for one in set(seq):
        single, alpha = Chem.MolFromSequence(one), depictions[one]
        match = single.GetSubstructMatch(alpha)
        conf = alpha.GetConformer()
        ca = conf.GetAtomPosition(1)
        rel[one] = {single.GetAtomWithIdx(match[i]).GetPDBResidueInfo().GetName().strip():
                    (conf.GetAtomPosition(i).x - ca.x, conf.GetAtomPosition(i).y - ca.y) for i in range(alpha.GetNumAtoms())}

    def place(mol, k_of):  # Cα of residue k on the zigzag; residues whose Cα is a peak point their side chains up
        Chem.RemoveStereochemistry(mol)  # drawn flat, like the alphabet
        conf = Chem.Conformer(mol.GetNumAtoms())
        for a in mol.GetAtoms():
            info = a.GetPDBResidueInfo()
            k = k_of(info)
            up = k % 2 == 0
            x, y = rel[seq[k]][info.GetName().strip()]
            conf.SetAtomPosition(a.GetIdx(), ((3 * k + 1) * STEP + x, (0.75 if up else 0.0) + (-y if up else y), 0.0))
        mol.RemoveAllConformers()
        mol.AddConformer(conf, assignId=True)
        return mol

    chain = place(Chem.MolFromSequence(seq), lambda info: info.GetResidueNumber() - 1)
    free = [place(Chem.MolFromSequence(one), lambda info, k=k: k) for k, one in enumerate(seq)]
    x0, y0, x1, y1 = extent(chain)
    for m in free:
        b = extent(m)
        x0, y0, x1, y1 = min(x0, b[0]), min(y0, b[1]), max(x1, b[2]), max(y1, b[3])
    window = (x0 - 2 * MARGIN, y0 - MARGIN, x1 + MARGIN, y1 + MARGIN)  # room on the left for H2N
    kind = {a[0]: a[3] for a in AMINO}

    def side_of(mol):
        return {a.GetIdx(): CLASS_SIDE[kind[seq[a.GetPDBResidueInfo().GetResidueNumber() - 1]]] for a in mol.GetAtoms()
                if a.GetPDBResidueInfo().GetName().strip() not in ("N", "CA", "C", "O", "OXT")}

    svg, _, size, _, atoms = draw(chain, side_of(chain), window)
    named = {(a.GetPDBResidueInfo().GetResidueNumber() - 1, a.GetPDBResidueInfo().GetName().strip()): atoms[a.GetIdx()]
             for a in chain.GetAtoms()}
    # every atom of the joined peptide, as "<residue index> <PDB atom name>" -> drawn position, so a 3D model of
    # the same residues can start exactly on the drawing
    out = {"seq": seq, "window": [round(v, 3) for v in window], "size": size, "svg": svg, "residues": [],
           "atoms": {f"{k} {pdb_name(seq[k], name)}": xy for (k, name), xy in named.items()}}
    for k, m in enumerate(free):
        for a in m.GetAtoms():  # number the free residue as residue k, for side_of
            a.GetPDBResidueInfo().SetResidueNumber(k + 1)
        fsvg, _, _, _, fatoms = draw(m, side_of(m), window)
        names = {a.GetPDBResidueInfo().GetName().strip(): fatoms[a.GetIdx()] for a in m.GetAtoms()}
        out["residues"].append({"one": seq[k], "class": kind[seq[k]], "svg": fsvg, "ca": named[(k, "CA")],
                                "n": names["N"], "oh": names["OXT"], "up": k % 2 == 0,
                                "backbone": [named[(k, x)] for x in ("N", "CA", "C")]})
    print(f"peptide {seq}: canvas {size[0]} x {size[1]} px")
    return out


# --- the same stretch in 3D, from a structure file (for the geometry slide after the alphabet) ----------------
MAIN_CHAIN = ("N", "CA", "C", "O")
KIND = {**dict.fromkeys(["ALA", "VAL", "ILE", "LEU", "MET", "PHE", "TYR", "TRP"], "hydrophobic"),
        **dict.fromkeys(["SER", "THR", "ASN", "GLN"], "polar"), **dict.fromkeys(["CYS", "GLY", "PRO"], "special"),
        **dict.fromkeys(["LYS", "ARG", "HIS"], "positive"), **dict.fromkeys(["ASP", "GLU"], "negative")}
# Double bonds by atom name (one Kekulé structure for the rings), for ball-and-stick drawing.
DOUBLE = {
    "*": [("C", "O")],
    "ASP": [("CG", "OD1")], "GLU": [("CD", "OE1")], "ASN": [("CG", "OD1")], "GLN": [("CD", "OE1")],
    "ARG": [("CZ", "NH2")],
    "PHE": [("CG", "CD1"), ("CE1", "CZ"), ("CE2", "CD2")],
    "TYR": [("CG", "CD1"), ("CE1", "CZ"), ("CE2", "CD2")],
    "HIS": [("CG", "CD2"), ("ND1", "CE1")],
    "TRP": [("CG", "CD1"), ("CE2", "CZ2"), ("CH2", "CZ3"), ("CE3", "CD2")],
}


def pos(atom):
    return np.array([atom.pos.x, atom.pos.y, atom.pos.z])


def segment(residues, start, length):
    res = residues[start:start + length]
    atoms, names, owner = [], [], []
    for k, r in enumerate(res):
        for a in r:
            if a.element.name == "H" or a.name == "OXT":
                continue
            atoms.append(pos(a))
            names.append((a.name, a.element.name))
            owner.append(k)
    xyz = np.array(atoms)
    index = {(owner[i], names[i][0]): i for i in range(len(names))}
    d = np.linalg.norm(xyz[:, None] - xyz[None], axis=-1)
    bonds = []
    for i, j in zip(*np.where(np.triu(d < 1.95, k=1))):
        same = owner[i] == owner[j]
        # within a residue, or the peptide bond C(k)-N(k+1)
        if same or {(names[i][0], owner[i] - owner[j]), (names[j][0], owner[j] - owner[i])} == {("C", -1), ("N", 1)}:
            bonds.append([int(i), int(j), 1])
    for b in bonds:
        k = owner[b[0]]
        if owner[b[1]] != k:
            continue
        pair = {names[b[0]][0], names[b[1]][0]}
        if any(pair == set(p) for p in DOUBLE["*"] + DOUBLE.get(res[k].name, [])):
            b[2] = 2
    # chain left to right, side chains spread up and down, the thin direction facing the viewer
    centre = xyz.mean(0)
    _, vecs = np.linalg.eigh((xyz - centre).T @ (xyz - centre))
    rot = vecs[:, ::-1].T
    if np.linalg.det(rot) < 0:
        rot[2] *= -1
    ca = [index[(k, "CA")] for k in range(len(res))]
    if np.dot(rot[0], xyz[ca[-1]] - xyz[ca[0]]) < 0:  # N-terminus on the left
        rot[0] *= -1
        rot[2] *= -1
    local = (xyz - centre) @ rot.T
    return {
        "residues": [{"one": gemmi.find_tabulated_residue(r.name).one_letter_code.upper(), "three": r.name.title(),
                      "num": r.seqid.num} for r in res],
        "atoms": [{"name": n, "el": e, "res": o, "bb": n in MAIN_CHAIN} for (n, e), o in zip(names, owner)],
        "xyz": np.round(local, 3).tolist(),
        "bonds": bonds,
        "ca": ca,
    }


def stretch(path, start, length):
    """Residues start..start+length-1 (author numbering) of the first protein chain, at full detail."""
    st = gemmi.read_structure(str(path))
    st.setup_entities()
    st.remove_hydrogens()
    st.remove_alternative_conformations()
    chain = next(c for c in st[0] if any(r.entity_type == gemmi.EntityType.Polymer for r in c))
    residues = [r for r in chain if r.entity_type == gemmi.EntityType.Polymer]
    k = next(i for i, r in enumerate(residues) if r.seqid.num == start)
    seg = segment(residues, k, length)
    seg["all_atom"] = len(seg["atoms"])
    seg["backbone"] = sum(a["bb"] for a in seg["atoms"])
    seg["source"] = st.name.upper() or path.stem.upper()
    print("3D stretch:", " ".join(f"{r['three']}{r['num']}" for r in seg["residues"]),
          f"({seg['all_atom']} heavy atoms, {seg['backbone']} backbone) from {seg['source']}")
    return seg


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out", type=Path)
    ap.add_argument("--peptide", help="a short sequence to draw as a peptide, no letter twice (e.g. MQIFVKT)")
    ap.add_argument("--structure", type=Path, help="take the peptide from this PDB/mmCIF file instead, in 3D too")
    ap.add_argument("--start", type=int, default=1, help="with --structure: first residue number (default 1)")
    ap.add_argument("--length", type=int, default=7, help="with --structure: residues in the stretch (default 7)")
    args = ap.parse_args()

    t = template()
    mols = []
    for one, three, name, cls, smiles in AMINO:
        mol = Chem.MolFromSmiles(smiles)
        match = mol.GetSubstructMatch(BACKBONE)
        # put the backbone atoms first, in template order, so atom 1 is always the Cα
        order = list(match) + [i for i in range(mol.GetNumAtoms()) if i not in match]
        mol = Chem.RenumberAtoms(mol, order)
        rdDepictor.GenerateDepictionMatching2DStructure(mol, t)
        hang(mol)
        mols.append(mol)
    generic = Chem.MolFromSmiles("NC(*)C(=O)O")
    match = generic.GetSubstructMatch(Chem.MolFromSmarts("N-C-C(=O)-O"))
    order = list(match) + [i for i in range(generic.GetNumAtoms()) if i not in match]
    generic = Chem.RenumberAtoms(generic, order)
    generic.GetAtomWithIdx(5).SetProp("atomLabel", "R")
    rdDepictor.GenerateDepictionMatching2DStructure(generic, t)

    # one window for all: the union of every molecule's atoms, plus a margin
    boxes = [extent(m) for m in mols]
    window = (min(b[0] for b in boxes) - MARGIN, min(b[1] for b in boxes) - MARGIN,
              max(b[2] for b in boxes) + MARGIN, max(b[3] for b in boxes) + MARGIN)
    out = {"amino_acids": [], "window": [round(v, 3) for v in window], "px": PX}
    for (one, three, name, cls, smiles), mol in zip(AMINO, mols):
        side = list(range(5, mol.GetNumAtoms()))
        svg, ca, size, bottom, _ = draw(mol, side, window)
        out["amino_acids"].append({"one": one, "three": three, "name": name, "class": cls,
                                   "side_atoms": len(side), "svg": svg, "ca": ca, "size": size, "bottom": bottom})
        print(f"{one} {three} {name:14s} {cls:9s} side chain {len(side):2d} heavy atoms, Cα drawn at {ca}")
    svg, ca, size, bottom, atoms = draw(generic, [5], window)
    # atoms: where each atom is drawn (N, Cα, C, O, OH, R), for marking the backbone and the side chain
    out["generic"] = {"svg": svg, "ca": ca, "size": size, "bottom": bottom, "atoms": atoms}

    if args.structure:
        out["segment"] = stretch(args.structure, args.start, args.length)
        args.peptide = "".join(r["one"] for r in out["segment"]["residues"])
    if args.peptide:
        assert len(set(args.peptide)) == len(args.peptide), "the slide picks residues by letter: no letter twice"
        segment = {"residues": [{"one": c} for c in args.peptide.upper()]}
        out["peptide"] = peptide(segment, {a[0]: m for a, m in zip(AMINO, mols)})
        if "segment" in out:
            check_pairing(out["segment"], out["peptide"])

    sizes = {tuple(a["ca"]) for a in out["amino_acids"]}
    if len(sizes) != 1:
        print("warning: the Cα is not in the same place in every drawing:", sizes)
    args.out.write_text(json.dumps(out))
    args.out.with_suffix(".js").write_text(
        f"(window.DATA = window.DATA || {{}})[{json.dumps(args.out.stem)}] = {json.dumps(out)};\n")


if __name__ == "__main__":
    main()
