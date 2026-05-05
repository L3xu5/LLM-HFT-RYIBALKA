/**
 * Xcode 16+ / Apple Clang: fmt 11 + FMT_STRING падает на consteval.
 * `-DFMT_USE_CONSTEVAL=0` не действует: base.h переопределяет макрос позже.
 * Патчим `Pods/fmt/include/fmt/base.h` в post_install (после `pod install`).
 *
 * @param {import('@expo/config-plugins').ExportedConfig} config
 */
function withFmtXcode16Fix(config) {
  const { withPodfile } = require('@expo/config-plugins');

  return withPodfile(config, (cfg) => {
    const marker = '# [expo] fmt base.h patch (Xcode 16+ / Apple Clang)';
    let contents = cfg.modResults.contents;
    if (contents.includes(marker)) return cfg;

    const fmtBlock = [
      '',
      `    ${marker}`,
      '    begin',
      "      fmt_base = File.join(installer.sandbox.root, 'fmt/include/fmt/base.h')",
      '      if File.exist?(fmt_base)',
      '        s = File.read(fmt_base)',
      "        unless s.include?('[expo-fmt-xcode16]')",
      '          re = /^#elif defined\\(__cpp_consteval\\)\\n#  define FMT_USE_CONSTEVAL 1/',
      '          rep = "#elif defined(__APPLE__) && defined(__clang__)\\n#  define FMT_USE_CONSTEVAL 0  // [expo-fmt-xcode16]\\n#elif defined(__cpp_consteval)\\n#  define FMT_USE_CONSTEVAL 1"',
      '          File.write(fmt_base, s.sub(re, rep)) if s.match?(re)',
      '        end',
      '      end',
      '    end',
      '',
    ].join('\n');

    const resourceBundleBlock = `    installer.target_installation_results.pod_target_installation_results
      .each do |pod_name, target_installation_result|
      target_installation_result.resource_bundle_targets.each do |resource_bundle_target|
        resource_bundle_target.build_configurations.each do |config|
          config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
        end
      end
    end`;

    if (contents.includes(resourceBundleBlock)) {
      cfg.modResults.contents = contents.replace(resourceBundleBlock, `${resourceBundleBlock}${fmtBlock}`);
      return cfg;
    }

    const postInstallClose = /(post_install do \|installer\|[\s\S]*?)(\n  end\nend\s*)$/m;
    if (contents.match(postInstallClose)) {
      cfg.modResults.contents = contents.replace(postInstallClose, `$1${fmtBlock}$2`);
      return cfg;
    }

    throw new Error(
      '[withFmtXcode16Fix] Не удалось изменить Podfile: не найден ожидаемый блок resource_bundle или post_install.',
    );
  });
}

module.exports = withFmtXcode16Fix;
