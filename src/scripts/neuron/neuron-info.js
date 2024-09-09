export function createNeuronPopup(svg) {
    const popup = svg.append("g")
        .attr("class", "neuron-popup")
        .style("display", "none")
        .style("pointer-events", "all");

    // Futuristic background with a gradient and glowing border
    popup.append("rect")
        .attr("width", 240)
        .attr("height", 250)
        .attr("fill", "url(#popupGradient)")  // Gradient fill
        .attr("stroke", "rgba(0, 255, 255, 1)")  // Neon glowing effect
        .attr("stroke-width", 2)
        .attr("rx", 15)
        .attr("ry", 15)
        .style("filter", "drop-shadow(0 0 15px rgba(0, 100, 255, 1))");

    // Define gradient for background
    svg.append("defs").append("linearGradient")
        .attr("id", "popupGradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "100%")
        .append("stop").attr("offset", "0%").attr("stop-color", "#0f0f0f")
        .append("stop").attr("offset", "100%").attr("stop-color", "#2f2f2f");

    // Title text for node info with neon glow
    popup.append("text")
        .attr("class", "popup-title")
        .attr("x", 15)
        .attr("y", 30)
        .attr("fill", "rgba(255, 99, 132, 1)")
        .style("font-family", "'Orbitron', sans-serif")  // Futuristic font
        .style("font-weight", "bold")
        .style("font-size", "18px")
        .style("text-shadow", "0 0 8px rgba(255, 99, 132, 1)");

    // Data fields with animated glow effect
    const fields = ["weight", "bias", "pre-activation", "activation", "gradient"];
    fields.forEach((field, index) => {
        popup.append("text")
            .attr("class", `popup-${field}`)
            .attr("x", 15)
            .attr("y", 60 + index * 30)
            .attr("fill", "#ffffff")
            .style("font-family", "'Orbitron', sans-serif")
            .style("font-size", "14px")
            .style("text-shadow", "0 0 6px rgba(255, 99, 132, 1)")
            .style("animation", "glowAnimation 2s infinite");
    });

    // Sparkline with neon glow effect
    const sparkline = popup.append("path")
        .attr("class", "sparkline")
        .attr("fill", "none")
        .attr("stroke", "rgba(0, 255, 255, 1)")  // Neon pink color for the sparkline
        .attr("stroke-width", 2)
        .style("filter", "drop-shadow(0 0 8px rgba(0, 255, 255, 1))");

    // CSS animations for glowing effect
    svg.append("style").text(`
        @keyframes glowAnimation {
            0% { text-shadow: 0 0 8px rgba(255, 99, 132, 1); }
            50% { text-shadow: 0 0 12px rgba(255, 99, 132, 1); }
            100% { text-shadow: 0 0 8px rgba(255, 99, 132, 1); }
        }
    `);

    return d3.select(popup.node());
}

export function updateNeuronPopup(popup, x, y, data) {
    const xOffset = -60;
    const yOffset = -50;

    popup.attr("transform", `translate(${x + xOffset},${y + yOffset})`)
        .style("display", "block");

    popup.select(".popup-title")
        .text(`${data.layerType} Node ${data.nodeIndex}`);

    popup.select(".popup-weight")
        .text(`Weight: ${typeof data.weight === 'number' ? data.weight.toFixed(4) : Array.isArray(data.weight) ? d3.mean(data.weight).toFixed(4) : data.weight}`);

    popup.select(".popup-bias")
        .text(`Bias: ${typeof data.bias === 'number' ? data.bias.toFixed(4) : Array.isArray(data.bias) ? d3.mean(data.bias).toFixed(4) : data.bias}`);

    popup.select(".popup-pre-activation")
        .text(`Weighted Sum: ${typeof data.preActivation === 'number' ? data.preActivation.toFixed(4) : 'N/A'}`);
    
    popup.select(".popup-activation")
        .text(`Activation: ${typeof data.activation === 'number' ? data.activation.toFixed(4) : 'N/A'}`);

    // Handle gradient similarly
    popup.select(".popup-gradient")
        .text(`Gradient: ${typeof data.gradient === 'number' ? data.gradient.toFixed(4) : Array.isArray(data.gradient) ? d3.mean(data.gradient).toFixed(4) : 'N/A'}`);

    // Sparkline for backpropagation visualization
    if (data.backpropHistory && data.backpropHistory.length > 0) {
        const lineGenerator = d3.line()
            .x((d, i) => i * 20)
            .y(d => d * -20);  // Flip the Y-axis to mimic graph direction

        popup.select(".sparkline")
            .attr("d", lineGenerator(data.backpropHistory))
            .attr("transform", "translate(10, 200)");
    } else {
        popup.select(".sparkline").attr("d", ""); // Clear sparkline if no data
    }
}

export function hideNeuronPopup(popup) {
    popup.style("display", "none");
}