#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <vector>

namespace py = pybind11;

// Fast 3D centroid calculation for atomic coordinates
std::vector<float> compute_centroid(const std::vector<std::vector<float>>& coords) {
    if (coords.empty()) return {0.0f, 0.0f, 0.0f};
    float x = 0.0f, y = 0.0f, z = 0.0f;
    for (const auto& point : coords) {
        x += point[0]; y += point[1]; z += point[2];
    }
    float n = static_cast<float>(coords.size());
    return {x / n, y / n, z / n};
}

PYBIND11_MODULE(prolife_engine, m) {
    m.doc() = "PRO-LIFE High-Performance Geometry Engine";
    m.def("compute_centroid", &compute_centroid, "Calculates centroid from 3D atomic coordinates");
}