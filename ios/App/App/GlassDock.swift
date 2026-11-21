import UIKit
import SwiftUI
import Capacitor

/// Dock principale in vetro liquido nativo (iOS 26: `glassEffect` interattivo; versioni precedenti:
/// materiale traslucido). Tenendo premuto e trascinando, una "lente" di vetro segue il dito da un
/// pulsante all'altro come nella barra dell'App Store; rilasciando si attiva il pulsante sotto il dito.
final class DockModel: ObservableObject {
    @Published var items: [DockItem] = []
    @Published var visible = true
    var onTap: (String) -> Void = { _ in }
}

struct DockItem: Identifiable, Equatable {
    let id: String
    let title: String
    let symbol: String
    let accent: Bool
}

struct GlassDockView: View {
    @ObservedObject var model: DockModel
    @State private var pressX: CGFloat? = nil
    private let itemW: CGFloat = 62
    private let pad: CGFloat = 8

    var body: some View {
        let n = CGFloat(max(model.items.count, 1))
        let totalW = itemW * n + pad * 2
        ZStack(alignment: .leading) {
            if let x = pressX {
                let cx = min(max(x, pad + itemW / 2), totalW - pad - itemW / 2)
                lens
                    .frame(width: itemW + 6, height: 56)
                    .offset(x: cx - (itemW + 6) / 2)
                    .allowsHitTesting(false)
                    .transition(.scale(scale: 0.6).combined(with: .opacity))
            }
            HStack(spacing: 0) {
                ForEach(model.items) { it in
                    VStack(spacing: 3) {
                        Image(systemName: it.symbol).font(.system(size: 19, weight: .regular))
                        Text(it.title).font(.system(size: 10.5, weight: .medium)).lineLimit(1).minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(it.accent ? Color(red: 0.79, green: 0.86, blue: 1.0) : Color.white)
                    .frame(width: itemW, height: 54)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityAction { model.onTap(it.id) }
                }
            }
            .padding(.horizontal, pad)
            .padding(.vertical, 5)
        }
        .frame(width: totalW, height: 64)
        .background(glass)
        .contentShape(Capsule())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { v in
                    withAnimation(.interactiveSpring(response: 0.22, dampingFraction: 0.72)) { pressX = v.location.x }
                }
                .onEnded { v in
                    let idx = Int((v.location.x - pad) / itemW)
                    if idx >= 0, idx < model.items.count, v.location.y > -30, v.location.y < 100 {
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        model.onTap(model.items[idx].id)
                    }
                    withAnimation(.spring(response: 0.34, dampingFraction: 0.78)) { pressX = nil }
                }
        )
        .scaleEffect(pressX == nil ? 1 : 1.03)
        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: pressX == nil)
        .opacity(model.visible ? 1 : 0)
        .animation(.easeOut(duration: 0.25), value: model.visible)
    }

    @ViewBuilder private var glass: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            Capsule().fill(Color.clear).glassEffect(.regular.interactive(), in: Capsule())
        } else {
            Capsule().fill(.ultraThinMaterial)
        }
        #else
        Capsule().fill(.ultraThinMaterial)
        #endif
    }

    @ViewBuilder private var lens: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            Capsule().fill(Color.clear)
                .glassEffect(.regular.tint(Color.white.opacity(0.10)).interactive(), in: Capsule())
                .scaleEffect(1.12)
        } else {
            Capsule().fill(Color.white.opacity(0.18))
        }
        #else
        Capsule().fill(Color.white.opacity(0.18))
        #endif
    }
}

@objc(GlassDockPlugin)
public class GlassDockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GlassDockPlugin"
    public let jsName = "GlassDock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
    ]
    private let model = DockModel()
    private var host: UIHostingController<GlassDockView>?

    @objc func show(_ call: CAPPluginCall) {
        let raw = call.getArray("items", JSObject.self) ?? []
        let items = raw.compactMap { o -> DockItem? in
            guard let id = o["id"] as? String else { return nil }
            return DockItem(id: id, title: o["title"] as? String ?? "", symbol: o["symbol"] as? String ?? "circle", accent: o["accent"] as? Bool ?? false)
        }
        DispatchQueue.main.async {
            self.model.items = items
            self.model.visible = true
            self.install()
            self.host?.view.isUserInteractionEnabled = true
            call.resolve()
        }
    }

    @objc func setVisible(_ call: CAPPluginCall) {
        let v = call.getBool("visible") ?? true
        DispatchQueue.main.async {
            self.model.visible = v
            self.host?.view.isUserInteractionEnabled = v
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.host?.willMove(toParent: nil)
            self.host?.view.removeFromSuperview()
            self.host?.removeFromParent()
            self.host = nil
            call.resolve()
        }
    }

    private func install() {
        guard host == nil, let vc = bridge?.viewController else { return }
        model.onTap = { [weak self] id in self?.notifyListeners("tap", data: ["id": id]) }
        let h = UIHostingController(rootView: GlassDockView(model: model))
        h.view.backgroundColor = .clear
        if #available(iOS 16.0, *) { h.sizingOptions = .intrinsicContentSize }
        vc.addChild(h)
        vc.view.addSubview(h.view)
        h.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            h.view.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
            h.view.bottomAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.bottomAnchor, constant: -6),
        ])
        h.didMove(toParent: vc)
        host = h
    }
}
