"""Turn a protein structure into what web/addons/cartoon.js draws: per residue, the Cα position, the secondary
structure and the way the ribbon faces.

    python tools/prep_protein.py talks/example/data/1ubq.cif talks/example/data/ubiquitin.json
    python tools/prep_protein.py my.pdb talks/<talk>/data/my_protein.json --chain B
    python tools/prep_protein.py talks/example/data/1ubq.cif talks/example/data/ubiquitin.json --atoms

Writes <out>.json and <out>.js; the .js sets window.DATA["<out stem>"], so a deck page that loads it with a
<script> tag works straight from disk (browsers will not fetch JSON from file://).

- Coordinates are in Å, centred on the Cα centroid and turned to the chain's principal axes: the longest
  axis along x (screen right), the second along z (screen up), the shortest along y (into the screen), which
  is the turntable's starting view (web/addons/turntable.js).
- Secondary structure ('H' helix, 'E' strand, 'C' anything else) comes from the file's helix and sheet
  records, or from DSSP via mdtraj when there are none (generated designs usually have none); without mdtraj
  it falls back to all coil and says so.
- With --atoms, every heavy atom too ("atoms": name, element, residue index, xyz in the same frame, and bonds:
  within a residue by distance, plus each peptide bond), for ball-and-stick side chains on the cartoon.
- The ribbon's facing is each residue's C→O direction, stored in a frame built from the Cα trace alone
  (ca_frame below, frameAt in cartoon.js), so a slide can move the Cα atoms and the ribbons turn with them.

Needs gemmi and numpy (pip install gemmi numpy; mdtraj is optional).
"""

import argparse
import json
from pathlib import Path

import gemmi
import numpy as np


def ca_frame(ca, i):
    """Orthonormal (tangent, bend, normal) at residue i from its neighbours' Cα; the ends borrow the next one in.
    Must match frameAt() in web/addons/cartoon.js."""
    i = min(max(i, 1), len(ca) - 2)
    t = ca[i + 1] - ca[i - 1]
    t /= np.linalg.norm(t)
    b = 2 * ca[i] - ca[i - 1] - ca[i + 1]
    b -= t * (t @ b)
    b /= np.linalg.norm(b)
    return t, b, np.cross(t, b)


def dssp(residues):
    """Simplified DSSP ('H', 'E', 'C') per residue, from mdtraj, or None without it."""
    try:
        import mdtraj
    except ImportError:
        return None
    import tempfile
    st = gemmi.Structure()
    model = gemmi.Model("1")
    chain = gemmi.Chain("A")
    for r in residues:
        chain.add_residue(r)
    model.add_chain(chain)
    st.add_model(model)
    st.setup_entities()
    with tempfile.NamedTemporaryFile(suffix=".pdb") as f:
        st.write_pdb(f.name)
        ss = mdtraj.compute_dssp(mdtraj.load(f.name), simplified=True)[0]
    assert len(ss) == len(residues), (len(ss), len(residues))
    return ["C" if c not in "HE" else c for c in ss]


def all_atoms(residues, centre, rot):
    """Every heavy atom (no OXT) in the cartoon's frame, and the bonds: pairs within 1.9 Å in one residue, and
    each residue's C to the next one's N."""
    names, elements, owner, xyz = [], [], [], []
    for k, r in enumerate(residues):
        for a in r:
            if a.element.name == "H" or a.name == "OXT":
                continue
            names.append(a.name)
            elements.append(a.element.name.title() if len(a.element.name) > 1 else a.element.name)
            owner.append(k)
            xyz.append(a.pos.tolist())
    xyz = (np.array(xyz) - centre) @ rot.T
    index = {(owner[i], names[i]): i for i in range(len(names))}
    bonds = []
    for k in range(len(residues)):
        members = [i for i in range(len(names)) if owner[i] == k]
        for x, i in enumerate(members):
            for j in members[x + 1:]:
                if np.linalg.norm(xyz[i] - xyz[j]) < 1.9:
                    bonds.append([i, j])
        if (k, "C") in index and (k + 1, "N") in index:
            bonds.append([index[(k, "C")], index[(k + 1, "N")]])
    return {"names": names, "elements": elements, "residue": owner, "xyz": np.round(xyz, 3).tolist(), "bonds": bonds}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("structure", type=Path, help="PDB or mmCIF file")
    ap.add_argument("out", type=Path, help="output .json (a .js beside it is written too)")
    ap.add_argument("--chain", help="chain name (default: the first protein chain)")
    ap.add_argument("--atoms", action="store_true", help="also write every heavy atom and the bonds")
    args = ap.parse_args()

    st = gemmi.read_structure(str(args.structure))
    st.setup_entities()
    st.remove_hydrogens()
    st.remove_alternative_conformations()
    model = st[0]
    is_protein = lambda r: r.entity_type == gemmi.EntityType.Polymer and r.find_atom("CA", "*") and r.find_atom("C", "*") \
        and r.find_atom("O", "*")
    chain = model[args.chain] if args.chain else next(c for c in model if any(is_protein(r) for r in c))
    residues = [r for r in chain if is_protein(r)]
    assert len(residues) >= 3, f"chain {chain.name}: only {len(residues)} residues with CA, C and O"
    pos = lambda r, name: np.array(r.find_atom(name, "*").pos.tolist())

    ca = np.array([pos(r, "CA") for r in residues])
    centre = ca.mean(0)
    # principal axes, largest spread first; right-handed, so the picture is not mirrored
    _, _, vt = np.linalg.svd(ca - centre)
    x, z = vt[0], vt[1]
    y = np.cross(z, x)
    rot = np.array([x, y, z])
    ca = (ca - centre) @ rot.T

    # secondary structure from the file's records, by author residue number
    index = {r.seqid.num: k for k, r in enumerate(residues)}
    ss = ["C"] * len(residues)

    def mark(start, end, code):
        if start.chain_name != chain.name:
            return
        for num in range(start.res_id.seqid.num, end.res_id.seqid.num + 1):
            if num in index:
                ss[index[num]] = code

    for helix in st.helices:
        mark(helix.start, helix.end, "H")
    for sheet in st.sheets:
        for strand in sheet.strands:
            mark(strand.start, strand.end, "E")
    if set(ss) == {"C"}:
        found = dssp(residues)
        if found is None:
            print("no helix/sheet records and no mdtraj for DSSP: drawing everything as coil")
        else:
            ss = found

    # carbonyl directions, in each residue's Cα frame
    coeffs = []
    for k, r in enumerate(residues):
        d = (pos(r, "O") - pos(r, "C")) @ rot.T
        d /= np.linalg.norm(d)
        t, b, n = ca_frame(ca, k)
        coeffs.append([round(float(d @ t), 4), round(float(d @ b), 4), round(float(d @ n), 4)])

    gaps = [k for k in range(len(ca) - 1) if np.linalg.norm(ca[k + 1] - ca[k]) > 4.2]
    s = "".join(ss)
    seq = "".join(gemmi.find_tabulated_residue(r.name).one_letter_code.upper()
                  if gemmi.find_tabulated_residue(r.name) else "X" for r in residues)
    radius = float(np.linalg.norm(ca, axis=1).max())
    print(f"{args.structure.name} chain {chain.name}: {len(ca)} residues ({s.count('H')} helix, {s.count('E')} strand, "
          f"{s.count('C')} other), radius {radius:.1f} Å; chain breaks after {gaps or 'none'}")
    out = {"source": args.structure.name, "chain": chain.name, "sequence": seq, "radius": round(radius, 2),
           "ca": np.round(ca, 3).tolist(), "ss": s, "dir": coeffs, "breaks": gaps}
    out["residues"] = [{"name": r.name.title(), "num": r.seqid.num} for r in residues]
    if args.atoms:
        out["atoms"] = all_atoms(residues, centre, rot)
        print(f"  {len(out['atoms']['xyz'])} heavy atoms, {len(out['atoms']['bonds'])} bonds")
    args.out.write_text(json.dumps(out))
    args.out.with_suffix(".js").write_text(
        f"(window.DATA = window.DATA || {{}})[{json.dumps(args.out.stem)}] = {json.dumps(out)};\n")


if __name__ == "__main__":
    main()
