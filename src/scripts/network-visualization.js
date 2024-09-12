// netowrk-visualization.js

import { updateLossChart } from "./chart-logic.js";
import { stopTraining } from './event-handlers.js';
import { getNodeData, handleNeuronMouseover, handleNeuronMouseleave, createNeuronPopup, updateNeuronPopup, hideNeuronPopup } from './neuron/neuron-info.js';
import { InputNode, HiddenNode, OutputNode } from './neuron/node.js';

let nodes = [];
let links = [];
let popup;
let isOverNode = false;
let isOverPopup = false;
let hidePopupTimeout;
let selectedNodeIndex = 0;
let currentHoveredNode = null;

export function drawNeuralNetwork(layers, weights, data) {
    d3.select("#visualization").html("");

    const svg = d3.select("#visualization").append("svg")
        .attr("width", window.innerWidth)
        .attr("height", window.innerHeight);

    const lightsGroup = svg.append("g").attr("class", "lights-group");
    const popupGroup = svg.append("g").attr("class", "popup-group");

    const forwardData = data?.forward_data;
    const layerSpacing = window.innerWidth / (layers.length + 1);
    const nodeRadius = 20;

    popup = createNeuronPopup(popupGroup);
    setupPopupHover(popup);

    nodes = layers.flatMap((layerSize, layerIndex) => 
        createLayerNodes(layerSize, layerIndex, layerSpacing, nodeRadius, svg, popup, popupGroup, forwardData, data, layers)
    );

    nodes.forEach(sourceNode => {
        if (sourceNode.layerIndex < layers.length - 1) {
            createLayerLinks(sourceNode, nodes, layers, lightsGroup, weights);
        }
    });
}

function createLayerNodes(layerSize, layerIndex, layerSpacing, nodeRadius, svg, popup, popupGroup, forwardData, data, layers) {
    const ySpacing = window.innerHeight / (layerSize + 1);
    const x = layerSpacing * (layerIndex + 1);

    return Array.from({ length: layerSize }, (_, i) => {
        const y = ySpacing * (i + 1);
        let node = createNode(layerIndex, i, x, y, nodeRadius, svg, popup, popupGroup, layers);
        const nodeData = getNodeData(layerIndex, i, forwardData, data, layers);
        node.updateData(nodeData);
        return node;
    });
}

function createNode(layerIndex, nodeIndex, x, y, radius, svg, popup, popupGroup, layers) {
    if (layerIndex === 0) {
        return new InputNode(x, y, radius, svg, nodeIndex, popup, popupGroup);
    } else if (layerIndex === layers.length - 1) {
        return new OutputNode(x, y, radius, svg, nodeIndex, layers.length, popup, popupGroup);
    } else {
        return new HiddenNode(x, y, radius, svg, layerIndex, nodeIndex, popup, popupGroup);
    }
}

function createLayerLinks(sourceNode, nodes, layers, lightsGroup, weights) {
    const nextLayerNodes = nodes.filter(node => node.layerIndex === sourceNode.layerIndex + 1);

    nextLayerNodes.forEach((targetNode, j) => {
        const weight = getWeightForLink(sourceNode, j, weights, layers);

        const line = lightsGroup.append("line")
            .attr("x1", sourceNode.x)
            .attr("y1", sourceNode.y)
            .attr("x2", targetNode.x)
            .attr("y2", targetNode.y)
            .attr("stroke", "rgba(255, 0, 85, 1)")
            .attr("stroke-width", 2)
            .attr("class", `line-${sourceNode.layerIndex}-${sourceNode.i}-${targetNode.i}`);

        setupLinkHover(line, sourceNode, targetNode, weight, lightsGroup);

        links.push({ source: sourceNode, target: targetNode, line, weight });
    });
}

function getWeightForLink(sourceNode, targetNodeIndex, weights, layers) {
    if (sourceNode.layerIndex === 0 && weights?.input_weights) {
        return weights.input_weights[targetNodeIndex]?.[sourceNode.i] ?? null;
    } else if (sourceNode.layerIndex === layers.length - 2 && weights?.output_weights) {
        return weights.output_weights[targetNodeIndex]?.[sourceNode.i] ?? null;
    } else if (weights?.hidden_weights?.[sourceNode.layerIndex]) {
        return weights.hidden_weights[sourceNode.layerIndex]?.[targetNodeIndex]?.[sourceNode.i] ?? null;
    }
    return null;
}

function setupPopupHover(popup) {
    popup.on("mouseenter", () => {
        isOverPopup = true;
        clearTimeout(hidePopupTimeout);
    }).on("mouseleave", () => {
        isOverPopup = false;
        if (!isOverNode) hideNeuronPopup(popup);
    });
}

function setupLinkHover(line, sourceNode, targetNode, weight, lightsGroup) {
    line.on("mouseenter", function (event) {
        d3.select(this)
            .attr("stroke", "rgba(255, 0, 85, 1)")
            .attr("stroke-width", 4)
            .style("filter", "drop-shadow(0 0 10px rgba(255, 0, 85, 1))");

        const weightText = weight !== null && !isNaN(weight) ? Number(weight).toFixed(4) : 'N/A';
        const tooltip = lightsGroup.append("text")
            .attr("x", (sourceNode.x + targetNode.x) / 2)
            .attr("y", (sourceNode.y + targetNode.y) / 2 - 10)
            .attr("fill", "white")
            .attr("font-size", "14px")
            .attr("text-anchor", "middle")
            .text(`Weight: ${weightText}`);

        d3.select(this).on("mouseleave", function () {
            d3.select(this)
                .attr("stroke", "rgba(255, 0, 85, 1)")
                .attr("stroke-width", 2)
                .style("filter", null);
            tooltip.remove();
        });
    });
}

export function updateNodesWithData(data, layers) {
    nodes.forEach(node => {
        const nodeData = getNodeData(node.layerIndex, node.i, data.forward_data, data, layers);
        node.updateData(nodeData);
        
        // If this node is currently being hovered over, update its popup
        if (node === currentHoveredNode) {
            updateNeuronPopup(popup, node.x, node.y, { 
                layerType: node.layerIndex === 0 ? "Input" : node.layerIndex === layers.length - 1 ? "Output" : "Hidden", 
                nodeIndex: node.i, 
                ...nodeData 
            });
        }
    });

    // Update link weights
    links.forEach(link => {
        const weight = getWeightForLink(link.source, link.target.i, data.weights_biases_data, layers);
        link.weight = weight;
    });
}

export function updateConnections(draggedNode) {
    links.forEach(link => {
        if (link.source === draggedNode || link.target === draggedNode) {
            link.line
                .attr("x1", link.source.x)
                .attr("y1", link.source.y)
                .attr("x2", link.target.x)
                .attr("y2", link.target.y);
        }
    });
}

export function animateDataFlow(data) {
    const svg = d3.select("svg");
    if (!Array.isArray(data)) data = [data];

    let epochIndex = 0;
    function animateEpoch() {
        if (epochIndex < data.length && !stopTraining) {
            const epochData = data[epochIndex];
            const forwardDuration = epochData.forward_data.forward_time * 1000;
            const backwardDuration = epochData.backward_data.backward_time * 1000;

            animateForwardPass(epochData.forward_data, svg, forwardDuration);
            animateBackwardPass(epochData.backward_data, svg, backwardDuration);
            updateLossChart(epochData.epoch, epochData.loss);

            epochIndex++;
            requestAnimationFrame(animateEpoch);
        }
    }

    requestAnimationFrame(animateEpoch);
}

export function animateForwardPass(forwardData, svg, duration) {
    const inputNodes = parseInt(document.getElementById('inputNodes').value);

    forwardData.input.forEach((inputBatch, batchIndex) => {
        inputBatch.forEach((input, index) => {
            if (index < inputNodes) {
                const inputNode = nodes.find(node => node.layerIndex === 0 && node.i === index);
                if (inputNode) {
                    animateLightThroughLayer(inputNode, forwardData.hidden_activation, duration * 50, svg, "forward");
                }
            }
        });
    });
}

export function animateBackwardPass(backwardData, svg, duration) {
    const hiddenNodes = nodes.filter(node => node.layerIndex === 1);
    const outputNodes = nodes.filter(node => node.layerIndex === 2);

    outputNodes.forEach(outputNode => {
        animateLightThroughLayer(outputNode, hiddenNodes, duration * 50, svg, "backward");
    });

    hiddenNodes.forEach(hiddenNode => {
        animateLightThroughLayer(hiddenNode, nodes.filter(node => node.layerIndex === 0), duration * 50, svg, "backward");
    });
}

export function animateLightThroughLayer(node, nextLayerData, duration, svg, direction) {
    const lightsGroup = svg.select(".lights-group");

    if (!node || typeof node.layerIndex === 'undefined') return;

    const nextLayerNodes = nodes.filter(n => n.layerIndex === node.layerIndex + 1);
    if (nextLayerNodes.length === 0) return;

    nextLayerNodes.forEach((targetNode, i) => {
        let line = svg.select(`.line-${node.layerIndex}-${node.i}-${targetNode.i}`);
        if (!line.empty()) {
            const light = lightsGroup.append("circle")
                .attr("r", 8)
                .attr("fill", "rgba(255, 255, 255, 0.9)")
                .style("stroke", "rgba(200, 200, 200, 0.7)")
                .style("stroke-width", 6);

            animateAlongLine(node.x, node.y, targetNode.x, targetNode.y, light, duration, svg, targetNode, direction);
        }
    });
}

function animateAlongLine(startX, startY, endX, endY, light, duration, svg, targetNode, direction) {
    const startTime = performance.now();

    function step(timestamp) {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;

        light.attr("transform", `translate(${currentX},${currentY})`);

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            light.remove();
            if (direction === "forward" && targetNode && targetNode.layerIndex < nodes.length - 1) {
                animateLightThroughLayer(targetNode, null, duration, svg, "forward");
            }
        }
    }

    requestAnimationFrame(step);
}

export function clearNetwork() {
    d3.select("#visualization").html("");
    nodes = [];
    links = [];
}

export function setCurrentHoveredNode(node) {
    currentHoveredNode = node;
}

export function clearCurrentHoveredNode() {
    currentHoveredNode = null;
}