// android/app/src/main/java/com/mouseshareapp/MainApplication.java
@Override
protected List<ReactPackage> getPackages() {
    List<ReactPackage> packages = new PackageList(this).getPackages();
    // Add this line:
    packages.add(new TouchInjectionPackage());
    return packages;
}