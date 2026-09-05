
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include <algorithm>
#include <cctype>
#include <cmath>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace py = pybind11;

namespace {

void validate_coords(const std::vector<std::vector<double>>& coords) {
    if (coords.empty()) {
        throw std::invalid_argument("Coordinate list cannot be empty.");
    }
    for (size_t i = 0; i < coords.size(); ++i) {
        if (coords[i].size() < 3) {
            throw std::invalid_argument("Each coordinate must have three values (x, y, z).");
        }
    }
}

std::string trim(const std::string& s) {
    size_t start = 0;
    while (start < s.size() && std::isspace(static_cast<unsigned char>(s[start]))) {
        ++start;
    }
    size_t end = s.size();
    while (end > start && std::isspace(static_cast<unsigned char>(s[end - 1]))) {
        --end;
    }
    return s.substr(start, end - start);
}

std::string slice(const std::string& line, size_t begin_1based, size_t end_1based) {
    if (line.size() < begin_1based) {
        return "";
    }
    size_t start = begin_1based - 1;
    size_t end = std::min(line.size(), end_1based);
    return line.substr(start, end - start);
}

int parse_int_field(const std::string& field, int fallback) {
    const std::string t = trim(field);
    if (t.empty()) {
        return fallback;
    }
    try {
        return std::stoi(t);
    } catch (...) {
        return fallback;
    }
}

}  // namespace

std::vector<double> compute_centroid(const std::vector<std::vector<double>>& coords) {
    validate_coords(coords);
    double x = 0.0, y = 0.0, z = 0.0;
    for (const auto& point : coords) {
        x += point[0];
        y += point[1];
        z += point[2];
    }
    const double n = static_cast<double>(coords.size());
    return {x / n, y / n, z / n};
}

py::dict compute_analysis(const std::vector<std::vector<double>>& coords) {
    validate_coords(coords);

    double sx = 0.0, sy = 0.0, sz = 0.0;
    double minX = coords[0][0], minY = coords[0][1], minZ = coords[0][2];
    double maxX = coords[0][0], maxY = coords[0][1], maxZ = coords[0][2];

    for (const auto& pt : coords) {
        sx += pt[0];
        sy += pt[1];
        sz += pt[2];
        if (pt[0] < minX) minX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[2] < minZ) minZ = pt[2];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] > maxY) maxY = pt[1];
        if (pt[2] > maxZ) maxZ = pt[2];
    }

    const double n = static_cast<double>(coords.size());
    const double cx = sx / n;
    const double cy = sy / n;
    const double cz = sz / n;

    double sum_sq = 0.0;
    double max_dist = 0.0;
    for (const auto& pt : coords) {
        const double dx = pt[0] - cx;
        const double dy = pt[1] - cy;
        const double dz = pt[2] - cz;
        const double d2 = dx * dx + dy * dy + dz * dz;
        sum_sq += d2;
        const double d = std::sqrt(d2);
        if (d > max_dist) max_dist = d;
    }

    py::dict bbox;
    bbox["min"] = py::make_tuple(minX, minY, minZ);
    bbox["max"] = py::make_tuple(maxX, maxY, maxZ);
    bbox["dimensions"] = py::make_tuple(maxX - minX, maxY - minY, maxZ - minZ);

    py::dict result;
    result["centroid"] = py::make_tuple(cx, cy, cz);
    result["count"] = static_cast<int>(coords.size());
    result["radiusOfGyration"] = std::sqrt(sum_sq / n);
    result["maxDistanceFromCentroid"] = max_dist;
    result["boundingBox"] = bbox;
    return result;
}

py::list parse_pdb(const std::string& text) {
    py::list atoms;
    std::istringstream stream(text);
    std::string line;
    int fallback_index = 0;

    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') {
            line.pop_back();
        }
        if (line.size() < 54) {
            continue;
        }
        const std::string rec = slice(line, 1, 6);
        const bool is_atom = rec == "ATOM  ";
        const bool is_het = rec == "HETATM";
        if (!is_atom && !is_het) {
            continue;
        }

        ++fallback_index;
        const std::string atom_name = trim(slice(line, 13, 16));
        const std::string res_name = trim(slice(line, 18, 20));
        std::string chain_id = trim(slice(line, 22, 22));
        if (chain_id.empty()) {
            chain_id = "A";
        }

        double x = 0.0, y = 0.0, z = 0.0;
        try {
            x = std::stod(trim(slice(line, 31, 38)));
            y = std::stod(trim(slice(line, 39, 46)));
            z = std::stod(trim(slice(line, 47, 54)));
        } catch (...) {
            continue;
        }

        std::string element = trim(slice(line, 77, 78));
        if (element.empty() && !atom_name.empty()) {
            element = atom_name.substr(0, 1);
        }

        py::dict atom;
        atom["index"] = parse_int_field(slice(line, 7, 11), fallback_index);
        atom["recordType"] = is_het ? "HETATM" : "ATOM";
        atom["atomName"] = atom_name;
        atom["residueName"] = res_name;
        atom["chainId"] = chain_id;
        atom["residueSeq"] = parse_int_field(slice(line, 23, 26), fallback_index);
        atom["x"] = x;
        atom["y"] = y;
        atom["z"] = z;
        atom["element"] = element;
        atoms.append(atom);
    }

    return atoms;
}

PYBIND11_MODULE(prolife_engine, m) {
    m.doc() = "PRO-LIFE high-performance PDB parse and geometry engine";
    m.def("compute_centroid", &compute_centroid, "Centroid of Nx3 atomic coordinates");
    m.def("compute_analysis", &compute_analysis, "Centroid, Rg, and bounding box");
    m.def("parse_pdb", &parse_pdb, "Parse ATOM/HETATM records from PDB text");
}
