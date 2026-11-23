import Foundation
import Security
import CryptoKit

@main struct Vault { static func main() {
do {
 let query: [String: Any] = [kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"org.fdu-utils.fdudash",kSecAttrAccount as String:"vault-key"]
 var result: CFTypeRef?
 var lookup = query
 lookup[kSecReturnData as String] = true
 let status = SecItemCopyMatching(lookup as CFDictionary,&result)
 let bytes: Data
 if status == errSecSuccess, let stored = result as? Data { bytes = stored }
 else if status == errSecItemNotFound {
  var random = Data(count:32)
  let code = random.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault,32,$0.baseAddress!) }
  guard code == errSecSuccess else { exit(1) }
  var add = query
  add[kSecValueData as String] = random
  add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
  let added=SecItemAdd(add as CFDictionary,nil)
  guard added == errSecSuccess else { fputs("Keychain add status: \(added)\n",stderr);exit(1) }
  bytes = random
 } else { fputs("Keychain lookup status: \(status)\n",stderr);exit(1) }
 let raw = FileHandle.standardInput.readDataToEndOfFile()
 guard let input = Data(base64Encoded:raw) else { exit(1) }
 let key = SymmetricKey(data:bytes)
 let output: Data
 if CommandLine.arguments.contains("--decrypt") {
  output = try AES.GCM.open(AES.GCM.SealedBox(combined:input),using:key)
 } else {
  output = try AES.GCM.seal(input,using:key).combined!
 }
 FileHandle.standardOutput.write(Data(output.base64EncodedString().utf8))
} catch { exit(1) }

}}
