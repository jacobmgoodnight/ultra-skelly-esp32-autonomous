#include <iostream>
#define REQUIRE(c) do{if(!(c))throw std::runtime_error(#c);}while(false)
size_t eyeWrites(){size_t n=0;for(const auto &f:fakeWrites)if(f[1]==0xf9){++n;REQUIRE(f[2]==7);}return n;}
int main(){try{
  setup();skellyDevice=new BLEAdvertisedDevice();found=true;REQUIRE(connectToSkelly());
  fakeWrites.clear();const uint32_t began=fakeNow;
  while(uint32_t(fakeNow-began)<600000)loop();
  REQUIRE(eyeWrites()==1); // One initialization, no periodic re-sends or switching.
  REQUIRE(lastEye==7);
  resetConnection();found=true;REQUIRE(connectToSkelly());const uint32_t reconnected=fakeNow;
  while(uint32_t(fakeNow-reconnected)<5000)loop();REQUIRE(eyeWrites()==2);
  std::cout<<"PASS fixed eye sends once per connection without periodic expression changes\n";
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<'\n';return 1;}}
