// Embeds the icon and version information into InkNote Studio.exe using a pure-JS
// PE resource editor, so Windows builds made on Linux/macOS don't need Wine/rcedit.
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const { NtExecutable, NtExecutableResource, Resource, Data } = await import('resedit');
  const { productFilename } = context.packager.appInfo;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const version = context.packager.appInfo.version;
  const [maj, min, pat] = version.split('.').map((n) => parseInt(n, 10) || 0);

  const exe = NtExecutable.from(fs.readFileSync(exePath), { ignoreCert: true });
  const res = NtExecutableResource.from(exe);

  const iconFile = Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  const groups = Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const lang = groups.length ? groups[0].lang : 1033;
  Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map((i) => i.data));

  const versions = Resource.VersionInfo.fromEntries(res.entries);
  const vi = versions[0] || Resource.VersionInfo.createEmpty();
  vi.setFileVersion(maj, min, pat, 0, 1033);
  vi.setProductVersion(maj, min, pat, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, {
    FileDescription: 'InkNote Studio',
    ProductName: 'InkNote Studio',
    CompanyName: 'InkNote Studio',
    LegalCopyright: `Copyright © ${new Date().getFullYear()} Abdelrahman Ahmed`,
    OriginalFilename: `${productFilename}.exe`,
    InternalName: 'InkNote Studio',
    FileVersion: version,
    ProductVersion: version,
  });
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • embedded icon and version ${version} into ${path.basename(exePath)}`);
};
