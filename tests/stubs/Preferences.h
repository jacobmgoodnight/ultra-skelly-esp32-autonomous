#pragma once
#include <string>
#include <map>
#include <vector>
#include <cstring>
inline std::map<std::string,std::vector<uint8_t>> fakeNVS;
inline bool fakeNVSOpen=true,fakeNVSWrite=true;
inline unsigned fakeNVSWriteCount=0;
class Preferences {
 public:
  bool begin(const char *,bool=false){return fakeNVSOpen;}
  void end(){}
  size_t getBytesLength(const char *key){const auto it=fakeNVS.find(key);return it==fakeNVS.end()?0:it->second.size();}
  size_t getBytes(const char *key,void *out,size_t n){const auto it=fakeNVS.find(key);if(it==fakeNVS.end()||it->second.size()!=n)return 0;memcpy(out,it->second.data(),n);return n;}
  size_t putBytes(const char *key,const void *data,size_t n){if(!fakeNVSWrite)return 0;++fakeNVSWriteCount;const uint8_t *p=static_cast<const uint8_t*>(data);fakeNVS[key]=std::vector<uint8_t>(p,p+n);return n;}
};
