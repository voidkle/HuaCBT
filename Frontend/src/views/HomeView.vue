<script>
import { userData } from '@/stores/RetrieveUserData'
import { mapState } from 'pinia'
export default{
  data(){
    return{
      hellow: "hi"
    }
  },

  computed:{
    ...mapState(userData, [''])
  },

  methods: {
    jeprut(){
      if(this.hellow == "state 1"){
        this.hellow = "state 2"
      }
      else {
        this.hellow ="state 1"
      }
    }
  },

  components:{

  },

  mounted(){
    this.hellow = 'kunjats'
  }
}
</script>

<template>  
<img srcset="/docs/images/examples/image-1.jpg 1x, /docs/images/examples/image-1@2x.jpg 2x" class="w-full h-auto max-w-xl rounded-lg" alt="image description">
<p class="dark:text-white text-gray-900">Lorem, ipsum dolor sit amet consectetur adipisicing elit. Placeat soluta rerum, optio recusandae impedit nisi cumque provident autem, perferendis natus ex sequi perspiciatis distinctio quo amet eaque, non doloremque. Excepturi eius, dolore exercitationem quasi quibusdam saepe repellendus mollitia fuga tempora dolor illo, consequuntur hic blanditiis voluptas perferendis earum doloremque magnam fugit culpa odio perspiciatis suscipit quaerat ducimus quo? Omnis repudiandae libero veritatis eius in. Est nihil esse at quaerat facilis unde facere alias nam iste reiciendis minus corrupti mollitia maxime minima ab tempora odio numquam praesentium voluptas cumque molestias, adipisci delectus eum veniam. Eveniet saepe fugiat maxime autem culpa tenetur.</p>
</template>
